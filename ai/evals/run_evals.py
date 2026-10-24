from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

from ai.models import textblob_baseline, vader_baseline

CASES_PATH = Path(__file__).with_name("test_cases.jsonl")
LOCAL_ZERO_COST = {"vader", "textblob", "roberta", "distilbert"}


def load_cases() -> list[dict]:
    return [
        json.loads(line)
        for line in CASES_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def get_predictor(approach: str):
    if approach == "vader":
        return vader_baseline.predict, "VADER", "baseline-v1"
    if approach == "textblob":
        return textblob_baseline.predict, "TextBlob", "baseline-v1"
    if approach == "roberta":
        from ai.models.roberta_sentiment import MODEL_ID, predict
        return predict, "RoBERTa", MODEL_ID
    if approach == "distilbert":
        from ai.models.distilbert_sentiment import MODEL_ID, predict
        return predict, "DistilBERT", MODEL_ID
    if approach == "openai":
        from ai.models.llm_classifier import predict
        return predict, "OpenAI Structured", "openai-structured-v1"
    raise ValueError(f"Unsupported approach: {approach}")


def get_admin_client():
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in root .env.")
    from supabase import create_client
    return create_client(url, key)


def persist_results(*, model_name, prompt_version, rubric_version, case_results, metrics):
    client = get_admin_client()
    started_at = datetime.now(timezone.utc).isoformat()
    run = client.table("eval_runs").insert({
        "model_name": model_name,
        "prompt_version": prompt_version,
        "rubric_version": rubric_version,
        "started_at": started_at,
        "accuracy": metrics["accuracy"],
        "precision_macro": metrics["precision_macro"],
        "recall_macro": metrics["recall_macro"],
        "f1_macro": metrics["f1_macro"],
        "avg_latency_ms": metrics["avg_latency_ms"],
        "total_cost": metrics["api_cost_usd"],
        "case_count": metrics["cases"],
        "result_source": "measured",
    }).execute()
    run_id = run.data[0]["id"]

    rows = []
    for result in case_results:
        sentiment_score = 2 if result["correct"] else 0
        rows.append({
            "eval_run_id": run_id,
            "test_case_id": result["test_case_id"],
            "score_total": sentiment_score,
            "sentiment_score": sentiment_score,
            "extraction_score": None,
            "grounding_score": None,
            "hallucination_score": None,
            "recommendation_score": None,
            "latency_ms": result["latency_ms"],
            "cost": result["cost"],
            "expected_sentiment": result["expected_sentiment"],
            "predicted_sentiment": result["predicted_sentiment"],
            "is_correct": result["correct"],
        })

    for start in range(0, len(rows), 100):
        client.table("eval_scores").insert(rows[start:start + 100]).execute()

    client.table("eval_runs").update({
        "completed_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", run_id).execute()
    return run_id


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--approach",
        choices=["vader", "textblob", "roberta", "distilbert", "openai"],
        required=True,
    )
    parser.add_argument("--limit", type=int)
    parser.add_argument("--persist", action="store_true")
    args = parser.parse_args()

    cases = [case for case in load_cases() if case.get("active", True)]
    if args.limit:
        cases = cases[:args.limit]

    predictor, model_name, prompt_version = get_predictor(args.approach)

    if args.approach in {"roberta", "distilbert"}:
        print(f"warming_up_model: {model_name}")
        predictor("This is a warm-up sentence.")

    y_true, y_pred, latencies, case_results = [], [], [], []
    costs: list[float] = []
    cost_known = True

    for case in cases:
        started = time.perf_counter()
        output = predictor(case["input_text"])
        latency_ms = (time.perf_counter() - started) * 1000
        expected = case["expected_output"]["sentiment"]
        predicted = output["sentiment"]

        if args.approach in LOCAL_ZERO_COST:
            cost = 0.0
        else:
            raw_cost = output.get("estimated_cost")
            if raw_cost is None:
                cost_known = False
                cost = None
            else:
                cost = float(raw_cost)
                costs.append(cost)

        y_true.append(expected)
        y_pred.append(predicted)
        latencies.append(latency_ms)
        case_results.append({
            "test_case_id": case["id"],
            "expected_sentiment": expected,
            "predicted_sentiment": predicted,
            "correct": expected == predicted,
            "latency_ms": latency_ms,
            "cost": cost,
        })

    accuracy = accuracy_score(y_true, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0
    )

    api_cost = 0.0 if args.approach in LOCAL_ZERO_COST else (sum(costs) if cost_known else None)
    result = {
        "approach": args.approach,
        "model_name": model_name,
        "cases": len(cases),
        "accuracy": round(float(accuracy), 4),
        "precision_macro": round(float(precision), 4),
        "recall_macro": round(float(recall), 4),
        "f1_macro": round(float(f1), 4),
        "avg_latency_ms": round(sum(latencies) / len(latencies), 3),
        "api_cost_usd": None if api_cost is None else round(float(api_cost), 6),
    }

    if args.persist:
        rubric_version = cases[0].get("rubric_version", "v1") if cases else "v1"
        run_id = persist_results(
            model_name=model_name,
            prompt_version=prompt_version,
            rubric_version=rubric_version,
            case_results=case_results,
            metrics=result,
        )
        result["persisted"] = True
        result["eval_run_id"] = run_id

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
