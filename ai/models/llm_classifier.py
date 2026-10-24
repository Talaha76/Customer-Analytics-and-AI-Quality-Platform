from __future__ import annotations
import json
import os
from openai import OpenAI

SCHEMA = {
    "type": "object",
    "properties": {
        "sentiment": {"type": "string", "enum": ["negative", "neutral", "positive"]},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["sentiment", "confidence"],
    "additionalProperties": False,
}

def _estimate_cost(response) -> float | None:
    input_rate = os.getenv("OPENAI_INPUT_COST_PER_M")
    output_rate = os.getenv("OPENAI_OUTPUT_COST_PER_M")
    if not input_rate or not output_rate:
        return None
    usage = getattr(response, "usage", None)
    if usage is None:
        return None
    input_tokens = float(getattr(usage, "input_tokens", 0) or 0)
    output_tokens = float(getattr(usage, "output_tokens", 0) or 0)
    return input_tokens / 1_000_000 * float(input_rate) + output_tokens / 1_000_000 * float(output_rate)

def predict(text: str, model: str | None = None) -> dict:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError(
            "OPENAI_API_KEY is blank. OpenAI evaluation is optional and will not run without an API key."
        )
    model = model or os.getenv("OPENAI_MODEL_A")
    if not model:
        raise RuntimeError("Set OPENAI_MODEL_A in the root .env before running the OpenAI evaluator.")

    client = OpenAI()
    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "system",
                "content": [{
                    "type": "input_text",
                    "text": "Classify only the sentiment expressed in the customer review. Do not add facts not present in the review.",
                }],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": str(text)}],
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "sentiment_result",
                "strict": True,
                "schema": SCHEMA,
            }
        },
    )
    parsed = json.loads(response.output_text)
    return {
        "sentiment": parsed["sentiment"],
        "confidence": float(parsed["confidence"]),
        "estimated_cost": _estimate_cost(response),
        "model_id": model,
    }
