import hashlib
import math
import re
from datetime import date, datetime


def _is_missing(value):
    if value is None:
        return True
    if isinstance(value, float):
        return math.isnan(value)
    return False


def clean_text(value):
    if _is_missing(value):
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def stable_id(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:24]


def parse_rating(value):
    if _is_missing(value) or value == "":
        return None
    try:
        rating = float(value)
    except (TypeError, ValueError):
        return None
    return rating if 0 <= rating <= 5 else None


def _json_safe(value):
    if _is_missing(value):
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    # numpy / pandas scalar values often expose .item().
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def normalize_record(row):
    keys = {str(key).lower(): key for key in row.keys()}

    text_key = next(
        (keys[key] for key in ["review", "text", "feedback", "comment", "content"] if key in keys),
        None,
    )
    text = clean_text(row.get(text_key)) if text_key else None
    if not text:
        return None

    rating_key = next((keys[key] for key in ["rating", "stars", "score"] if key in keys), None)
    date_key = next((keys[key] for key in ["created_at", "date", "timestamp"] if key in keys), None)
    source_key = next((keys[key] for key in ["source", "channel"] if key in keys), None)
    id_key = keys.get("id")

    raw_external_id = row.get(id_key) if id_key else None
    external_id = clean_text(raw_external_id) or stable_id(text)

    raw_created_at = row.get(date_key) if date_key else None
    created_at = None if _is_missing(raw_created_at) else clean_text(raw_created_at)

    known = {key for key in [id_key, text_key, rating_key, date_key, source_key] if key is not None}
    metadata = {str(key): _json_safe(value) for key, value in row.items() if key not in known}

    return {
        "external_id": external_id,
        "text": text,
        "rating": parse_rating(row.get(rating_key)) if rating_key else None,
        "source": clean_text(row.get(source_key)) if source_key else "import",
        "created_at": created_at,
        "metadata": metadata,
    }
