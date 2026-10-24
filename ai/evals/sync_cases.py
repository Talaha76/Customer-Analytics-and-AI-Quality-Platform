from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

CASES_PATH = Path(__file__).with_name("test_cases.jsonl")


def get_admin_client():
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise RuntimeError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env."
        )

    return create_client(url, key)


def load_cases() -> list[dict]:
    cases = []
    for line in CASES_PATH.read_text(encoding="utf-8").splitlines():
        if line.strip():
            cases.append(json.loads(line))
    return cases


def main():
    cases = load_cases()

    if not cases:
        raise RuntimeError("No eval cases found in ai/evals/test_cases.jsonl")

    client = get_admin_client()

    # Upsert makes this safe to rerun: matching case IDs are updated
    # instead of creating duplicates.
    client.table("eval_test_cases").upsert(
        cases,
        on_conflict="id",
    ).execute()

    print(f"eval_cases_loaded: {len(cases)}")
    print("table: eval_test_cases")
    print("mode: upsert (safe to rerun)")


if __name__ == "__main__":
    main()
