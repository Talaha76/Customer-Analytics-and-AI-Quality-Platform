"""SafeVision ingestion pipeline.

Examples
--------
Dry-run a file locally (no database writes):
    python -m ai.pipelines.ingest sample_data/nova_demo/novaphone_x.csv

Load a file into Supabase for a product:
    python -m ai.pipelines.ingest sample_data/nova_demo/novaphone_x.csv --write --product "NovaPhone X"
"""

import argparse
import json
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from .normalize import normalize_record


def load_file(path):
    path = Path(path)
    suffix = path.suffix.lower()

    if suffix == ".csv":
        return pd.read_csv(path).to_dict("records")
    if suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else data.get("rows", [])
    if suffix == ".jsonl":
        return [
            json.loads(line)
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    raise ValueError("Supported formats: CSV, JSON, JSONL")


def ingest_records(path):
    rows = load_file(path)
    accepted = []
    seen = set()
    invalid = 0
    duplicates = 0

    for row in rows:
        normalized = normalize_record(row)
        if not normalized:
            invalid += 1
            continue

        key = normalized["external_id"]
        if key in seen:
            duplicates += 1
            continue

        seen.add(key)
        accepted.append(normalized)

    summary = {
        "rows_received": len(rows),
        "rows_accepted": len(accepted),
        "duplicates_removed": duplicates,
        "invalid_rows": invalid,
    }
    return accepted, summary


def get_supabase_admin_client():
    """Create the server-side Supabase client used by the ETL.

    This intentionally uses the private server key from .env. Never expose this
    key in frontend code or in a NEXT_PUBLIC_* variable.
    """

    load_dotenv()
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not url or not key:
        raise RuntimeError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env. "
            "Add your Supabase project URL and private server/secret key first."
        )

    try:
        from supabase import create_client
    except ImportError as exc:
        raise RuntimeError(
            "The supabase Python package is not installed. Run: pip install -r requirements.txt"
        ) from exc

    return create_client(url, key)


def get_product_id(client, product_name):
    response = (
        client.table("products")
        .select("id,name")
        .eq("name", product_name)
        .limit(2)
        .execute()
    )
    rows = response.data or []

    if not rows:
        raise RuntimeError(f'No product named "{product_name}" exists in Supabase.')
    if len(rows) > 1:
        raise RuntimeError(
            f'More than one product named "{product_name}" exists. '
            "Use unique product names before importing."
        )
    return rows[0]["id"]


def ensure_dataset_not_loaded(client, product_id, filename):
    response = (
        client.table("datasets")
        .select("id,filename")
        .eq("product_id", product_id)
        .eq("filename", filename)
        .limit(1)
        .execute()
    )
    if response.data:
        raise RuntimeError(
            f'"{filename}" has already been loaded for this product. '
            "The import was stopped to prevent duplicate portfolio metrics."
        )


def create_dataset(client, product_id, path):
    path = Path(path)
    payload = {
        "product_id": product_id,
        "filename": path.name,
        "source_type": path.suffix.lower().lstrip(".") or "unknown",
    }
    response = client.table("datasets").insert(payload).execute()
    if not response.data:
        raise RuntimeError("Supabase did not return the newly created dataset row.")
    return response.data[0]["id"]


def insert_feedback(client, dataset_id, records, chunk_size=200):
    inserted = 0
    for start in range(0, len(records), chunk_size):
        chunk = records[start : start + chunk_size]
        payload = [{**record, "dataset_id": dataset_id} for record in chunk]
        response = client.table("feedback").insert(payload).execute()
        inserted += len(response.data or [])
    return inserted


def write_to_supabase(path, records, product_name, chunk_size=200):
    client = get_supabase_admin_client()
    product_id = get_product_id(client, product_name)
    filename = Path(path).name

    ensure_dataset_not_loaded(client, product_id, filename)
    dataset_id = create_dataset(client, product_id, path)

    try:
        inserted = insert_feedback(client, dataset_id, records, chunk_size=chunk_size)
    except Exception:
        # Avoid leaving an empty/partial dataset record if the feedback write fails.
        client.table("datasets").delete().eq("id", dataset_id).execute()
        raise

    return {"dataset_id": dataset_id, "rows_written": inserted, "product": product_name}


def main():
    parser = argparse.ArgumentParser(description="Normalize SafeVision customer feedback.")
    parser.add_argument("path", help="CSV, JSON, or JSONL file")
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write normalized records to Supabase. Without this flag the command is a dry run.",
    )
    parser.add_argument(
        "--product",
        help='Exact product name in Supabase, e.g. "NovaPhone X". Required with --write.',
    )
    parser.add_argument("--chunk-size", type=int, default=200)
    args = parser.parse_args()

    records, summary = ingest_records(args.path)
    for key, value in summary.items():
        print(f"{key}: {value}")

    if not args.write:
        print("mode: dry-run (Supabase was not modified)")
        return

    if not args.product:
        parser.error("--product is required when --write is used")

    result = write_to_supabase(args.path, records, args.product, args.chunk_size)
    print(f"product: {result['product']}")
    print(f"dataset_id: {result['dataset_id']}")
    print(f"rows_written: {result['rows_written']}")


if __name__ == "__main__":
    main()
