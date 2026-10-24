"""Run free baseline NLP analysis over feedback stored in Supabase.

Examples
--------
Run both free baselines across all feedback:
    python -m ai.pipelines.analyze_feedback --approach both

Run one baseline only:
    python -m ai.pipelines.analyze_feedback --approach vader
    python -m ai.pipelines.analyze_feedback --approach textblob

This module never calls the OpenAI API. VADER and TextBlob run locally and
therefore have $0 API cost.
"""

from __future__ import annotations

import argparse
import statistics
import time
from typing import Callable

from ai.models.textblob_baseline import predict as textblob_predict
from ai.models.vader_baseline import predict as vader_predict
from ai.pipelines.ingest import get_supabase_admin_client


BASELINES: dict[str, tuple[str, Callable[[str], dict]]] = {
    "vader": ("VADER", vader_predict),
    "textblob": ("TextBlob", textblob_predict),
}

PROMPT_VERSION = "baseline-v1"


def fetch_feedback(client, limit: int | None = None, page_size: int = 500) -> list[dict]:
    """Fetch feedback in deterministic pages so datasets >1,000 rows work."""
    rows: list[dict] = []
    offset = 0

    while True:
        remaining = None if limit is None else limit - len(rows)
        if remaining is not None and remaining <= 0:
            break

        take = page_size if remaining is None else min(page_size, remaining)
        response = (
            client.table("feedback")
            .select("id,text")
            .order("id")
            .range(offset, offset + take - 1)
            .execute()
        )
        page = response.data or []
        rows.extend(page)

        if len(page) < take:
            break
        offset += take

    return rows


def existing_feedback_ids(client, model_name: str, feedback_ids: list[str]) -> set[str]:
    """Return feedback ids that already have this baseline analysis."""
    existing: set[str] = set()
    chunk_size = 200

    for start in range(0, len(feedback_ids), chunk_size):
        ids = feedback_ids[start : start + chunk_size]
        if not ids:
            continue
        response = (
            client.table("analyses")
            .select("feedback_id")
            .eq("model_name", model_name)
            .eq("prompt_version", PROMPT_VERSION)
            .in_("feedback_id", ids)
            .execute()
        )
        existing.update(row["feedback_id"] for row in (response.data or []))

    return existing


def analyze_rows(rows: list[dict], model_name: str, predict_fn: Callable[[str], dict]) -> tuple[list[dict], list[float]]:
    payload: list[dict] = []
    latencies: list[float] = []

    for row in rows:
        started = time.perf_counter()
        result = predict_fn(row["text"])
        latency_ms = (time.perf_counter() - started) * 1000
        latencies.append(latency_ms)

        payload.append(
            {
                "feedback_id": row["id"],
                "model_name": model_name,
                "prompt_version": PROMPT_VERSION,
                "sentiment": result["sentiment"],
                "sentiment_confidence": float(result.get("confidence", 0.0)),
                "topics": [],
                "pain_points": [],
                "feature_requests": [],
                "latency_ms": latency_ms,
                "estimated_cost": 0,
            }
        )

    return payload, latencies


def insert_analyses(client, payload: list[dict], chunk_size: int = 200) -> int:
    inserted = 0
    for start in range(0, len(payload), chunk_size):
        chunk = payload[start : start + chunk_size]
        response = client.table("analyses").insert(chunk).execute()
        inserted += len(response.data or [])
    return inserted


def run_baseline(client, rows: list[dict], approach: str, chunk_size: int = 200) -> dict:
    model_name, predict_fn = BASELINES[approach]
    ids = [row["id"] for row in rows]
    already_done = existing_feedback_ids(client, model_name, ids)
    pending = [row for row in rows if row["id"] not in already_done]

    payload, latencies = analyze_rows(pending, model_name, predict_fn)
    rows_written = insert_analyses(client, payload, chunk_size=chunk_size) if payload else 0

    return {
        "model": model_name,
        "rows_seen": len(rows),
        "rows_skipped_existing": len(already_done),
        "rows_written": rows_written,
        "avg_latency_ms": statistics.fmean(latencies) if latencies else 0.0,
        "estimated_api_cost": 0.0,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze Supabase feedback with free local baselines.")
    parser.add_argument(
        "--approach",
        choices=["vader", "textblob", "both"],
        default="both",
        help="Free local baseline(s) to run.",
    )
    parser.add_argument("--limit", type=int, default=None, help="Optional number of feedback rows to analyze.")
    parser.add_argument("--page-size", type=int, default=500)
    parser.add_argument("--chunk-size", type=int, default=200)
    args = parser.parse_args()

    client = get_supabase_admin_client()
    rows = fetch_feedback(client, limit=args.limit, page_size=args.page_size)
    if not rows:
        raise RuntimeError("No rows found in public.feedback. Load the demo datasets first.")

    approaches = ["vader", "textblob"] if args.approach == "both" else [args.approach]

    print(f"feedback_rows_found: {len(rows)}")
    for approach in approaches:
        result = run_baseline(client, rows, approach, chunk_size=args.chunk_size)
        print("---")
        print(f"model: {result['model']}")
        print(f"rows_seen: {result['rows_seen']}")
        print(f"rows_skipped_existing: {result['rows_skipped_existing']}")
        print(f"rows_written: {result['rows_written']}")
        print(f"avg_latency_ms: {result['avg_latency_ms']:.4f}")
        print(f"estimated_api_cost: ${result['estimated_api_cost']:.6f}")


if __name__ == "__main__":
    main()
