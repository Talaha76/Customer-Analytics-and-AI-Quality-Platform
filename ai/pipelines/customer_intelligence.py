from __future__ import annotations

import argparse
import math
import os
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer

from ai.models.vader_baseline import predict as vader_predict

METHOD = "tfidf-rules-v1"
REQUEST_RE = re.compile(
    r"\b(wish|would like|want|needs?|should add|could add|please add|feature request|missing|would be nice|hope .* add)\b",
    re.IGNORECASE,
)
GENERIC = {
    "product", "really", "good", "great", "nice", "love", "like", "use", "using",
    "works", "work", "thing", "things", "time", "day", "days", "just", "much",
    "better", "best", "new", "got", "make", "makes", "overall", "device",
}


def client():
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in root .env")
    from supabase import create_client
    return create_client(url, key)


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def clean_term(term: str, product_name: str) -> bool:
    tokens = re.findall(r"[a-z][a-z0-9'-]+", term.lower())
    if not tokens:
        return False
    product_tokens = set(re.findall(r"[a-z]+", product_name.lower()))
    return all(token not in GENERIC and token not in product_tokens and len(token) >= 3 for token in tokens)


def tfidf_terms(rows, product_name: str, limit=12):
    """Return robust TF-IDF terms for a review subset.

    Small or repetitive subsets (for example, only a handful of feature-request
    reviews) can cause scikit-learn to prune every token. We progressively relax
    document-frequency pruning so the intelligence pipeline skips gracefully
    instead of crashing.
    """
    docs = [
        str(row.get("text") or "").strip()
        for row in rows
        if str(row.get("text") or "").strip()
    ]
    if len(docs) < 2:
        return []

    attempts = [
        {
            "ngram_range": (1, 2),
            "min_df": 2 if len(docs) >= 10 else 1,
            "max_df": 0.92,
        },
        {
            "ngram_range": (1, 2),
            "min_df": 1,
            "max_df": 1.0,
        },
        {
            "ngram_range": (1, 1),
            "min_df": 1,
            "max_df": 1.0,
        },
    ]

    matrix = None
    vectorizer = None

    for config in attempts:
        candidate = TfidfVectorizer(
            stop_words="english",
            ngram_range=config["ngram_range"],
            min_df=config["min_df"],
            max_df=config["max_df"],
            max_features=500,
            sublinear_tf=True,
        )
        try:
            candidate_matrix = candidate.fit_transform(docs)
        except ValueError as exc:
            message = str(exc).lower()
            if "no terms remain" in message or "empty vocabulary" in message:
                continue
            raise

        if candidate_matrix.shape[1] == 0:
            continue

        vectorizer = candidate
        matrix = candidate_matrix
        break

    if vectorizer is None or matrix is None:
        return []

    features = vectorizer.get_feature_names_out()
    means = matrix.mean(axis=0).A1
    ranked = sorted(zip(features, means), key=lambda item: item[1], reverse=True)

    output = []
    seen_tokens = set()
    for term, score in ranked:
        if not clean_term(term, product_name):
            continue

        base = set(term.split())
        if any(
            base.issubset(set(existing.split()))
            or set(existing.split()).issubset(base)
            for existing in seen_tokens
        ):
            continue

        output.append((term, float(score)))
        seen_tokens.add(term)

        if len(output) >= limit:
            break

    return output


def matches_term(text: str, term: str) -> bool:
    low = text.lower()
    if term.lower() in low:
        return True
    return all(token in low for token in term.lower().split())


def evidence(rows, term, limit=5, sentiment=None):
    matches = []
    for row in rows:
        if sentiment and row["sentiment"] != sentiment:
            continue
        if matches_term(row["text"], term):
            matches.append(row["id"])
        if len(matches) >= limit:
            break
    return matches


def confidence_for(count, total):
    share = count / max(1, total)
    if count >= 12 or share >= 0.12:
        return "high"
    if count >= 5 or share >= 0.05:
        return "medium"
    return "low"


def build_for_product(product, rows):
    for row in rows:
        row["sentiment"] = vader_predict(row["text"])["sentiment"]
        row["date"] = parse_date(row.get("created_at"))

    insights = []
    themes = tfidf_terms(rows, product["name"], limit=10)
    total = len(rows)

    for term, _score in themes[:6]:
        matched = [r for r in rows if matches_term(r["text"], term)]
        sentiments = [r["sentiment"] for r in matched]
        dominant = max(("positive", "neutral", "negative"), key=sentiments.count) if sentiments else "neutral"
        insights.append({
            "product_id": product["id"],
            "insight_type": "theme",
            "title": term.title(),
            "description": f"{len(matched)} reviews mention the data-derived theme '{term}'.",
            "topic": term,
            "sentiment": dominant,
            "mention_count": len(matched),
            "current_share": round(len(matched) / max(1, total), 4),
            "confidence": confidence_for(len(matched), total),
            "evidence_feedback_ids": [r["id"] for r in matched[:5]],
            "method": METHOD,
        })

    negative_rows = [r for r in rows if r["sentiment"] == "negative"]
    for term, _ in tfidf_terms(negative_rows, product["name"], limit=6)[:3]:
        matched = [r for r in negative_rows if matches_term(r["text"], term)]
        insights.append({
            "product_id": product["id"],
            "insight_type": "pain_point",
            "title": f"{term.title()} friction",
            "description": f"{len(matched)} negative reviews mention '{term}', making it a recurring customer pain point.",
            "topic": term,
            "sentiment": "negative",
            "mention_count": len(matched),
            "current_share": round(len(matched) / max(1, len(negative_rows)), 4),
            "confidence": confidence_for(len(matched), max(1, len(negative_rows))),
            "evidence_feedback_ids": [r["id"] for r in matched[:5]],
            "method": METHOD,
        })

    request_rows = [r for r in rows if REQUEST_RE.search(r["text"])]
    for term, _ in tfidf_terms(request_rows, product["name"], limit=6)[:3]:
        matched = [r for r in request_rows if matches_term(r["text"], term)]
        insights.append({
            "product_id": product["id"],
            "insight_type": "feature_request",
            "title": f"Request: {term.title()}",
            "description": f"{len(matched)} reviews contain request language connected to '{term}'.",
            "topic": term,
            "sentiment": "neutral",
            "mention_count": len(matched),
            "current_share": round(len(matched) / max(1, total), 4),
            "confidence": confidence_for(len(matched), total),
            "evidence_feedback_ids": [r["id"] for r in matched[:5]],
            "method": METHOD,
        })

    dated = [r for r in rows if r["date"] is not None]
    if dated:
        anchor = max(r["date"] for r in dated)
        current_start = anchor - timedelta(days=29)
        previous_start = current_start - timedelta(days=30)
        current_rows = [r for r in dated if current_start <= r["date"] <= anchor]
        previous_rows = [r for r in dated if previous_start <= r["date"] < current_start]

        for term, _ in themes[:10]:
            current_count = sum(matches_term(r["text"], term) for r in current_rows)
            previous_count = sum(matches_term(r["text"], term) for r in previous_rows)
            current_share = current_count / max(1, len(current_rows))
            previous_share = previous_count / max(1, len(previous_rows))
            if previous_share == 0:
                change = 100.0 if current_share > 0 else 0.0
            else:
                change = ((current_share - previous_share) / previous_share) * 100
            if current_count >= 2 and change >= 25:
                matches = [r for r in current_rows if matches_term(r["text"], term)]
                insights.append({
                    "product_id": product["id"],
                    "insight_type": "emerging_issue",
                    "title": f"Rising signal: {term.title()}",
                    "description": f"Mentions of '{term}' increased from {previous_share * 100:.1f}% to {current_share * 100:.1f}% of reviews across consecutive 30-day windows.",
                    "topic": term,
                    "sentiment": "negative" if sum(r["sentiment"] == "negative" for r in matches) >= sum(r["sentiment"] == "positive" for r in matches) else "neutral",
                    "mention_count": current_count,
                    "current_share": round(current_share, 4),
                    "previous_share": round(previous_share, 4),
                    "change_pct": round(change, 2),
                    "confidence": confidence_for(current_count, max(1, len(current_rows))),
                    "evidence_feedback_ids": [r["id"] for r in matches[:5]],
                    "method": METHOD,
                })

    pain_points = [i for i in insights if i["insight_type"] == "pain_point"]
    emerging = [i for i in insights if i["insight_type"] == "emerging_issue" and i.get("sentiment") == "negative"]
    candidate = max(emerging + pain_points, key=lambda x: (x.get("change_pct") or 0, x["mention_count"]), default=None)
    if candidate:
        topic = candidate["topic"]
        ids = candidate["evidence_feedback_ids"]
        insights.append({
            "product_id": product["id"],
            "insight_type": "recommendation",
            "title": f"Prioritize {topic}",
            "description": f"Investigate and prioritize the '{topic}' experience. This recommendation is grounded in {candidate['mention_count']} supporting reviews and is linked to the evidence shown in the dashboard.",
            "topic": topic,
            "sentiment": "negative",
            "mention_count": candidate["mention_count"],
            "current_share": candidate.get("current_share"),
            "previous_share": candidate.get("previous_share"),
            "change_pct": candidate.get("change_pct"),
            "confidence": candidate["confidence"],
            "evidence_feedback_ids": ids,
            "method": METHOD,
        })

    return insights


def fetch_all(db, table_name: str, columns: str, page_size: int = 1000):
    """Fetch every row from a Supabase table using PostgREST pagination."""
    rows = []
    start = 0

    while True:
        page = (
            db.table(table_name)
            .select(columns)
            .range(start, start + page_size - 1)
            .execute()
            .data
            or []
        )
        rows.extend(page)

        if len(page) < page_size:
            break

        start += page_size

    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Persist generated insights to Supabase")
    args = parser.parse_args()
    db = client()

    products = fetch_all(db, "products", "id,name,category")
    datasets = fetch_all(db, "datasets", "id,product_id")
    feedback = fetch_all(
        db,
        "feedback",
        "id,dataset_id,text,rating,source,created_at",
    )
    dataset_to_product = {row["id"]: row["product_id"] for row in datasets}
    grouped = defaultdict(list)
    for row in feedback:
        pid = dataset_to_product.get(row.get("dataset_id"))
        if pid and str(row.get("text") or "").strip():
            grouped[pid].append(row)

    output = []
    for product in products:
        product_rows = grouped.get(product["id"], [])
        if not product_rows:
            continue
        output.extend(build_for_product(product, product_rows))

    print(f"products_analyzed: {len([p for p in products if grouped.get(p['id'])])}")
    print(f"reviews_analyzed: {sum(len(v) for v in grouped.values())}")
    print(f"insights_generated: {len(output)}")
    print(f"method: {METHOD}")

    if args.write:
        db.table("customer_insights").delete().eq("method", METHOD).execute()
        for start in range(0, len(output), 100):
            db.table("customer_insights").insert(output[start:start + 100]).execute()
        print("mode: persisted")
    else:
        print("mode: dry-run (use --write to persist)")


if __name__ == "__main__":
    main()
