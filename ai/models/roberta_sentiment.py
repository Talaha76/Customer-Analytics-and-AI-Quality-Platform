from __future__ import annotations
from functools import lru_cache

MODEL_ID = "cardiffnlp/twitter-roberta-base-sentiment-latest"

@lru_cache(maxsize=1)
def _load():
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
    model.eval()
    return tokenizer, model, torch

def predict(text: str) -> dict:
    tokenizer, model, torch = _load()
    inputs = tokenizer(str(text), return_tensors="pt", truncation=True, max_length=512)
    with torch.inference_mode():
        logits = model(**inputs).logits[0]
        probabilities = torch.softmax(logits, dim=-1)
    index = int(torch.argmax(probabilities).item())
    raw_label = str(model.config.id2label.get(index, f"LABEL_{index}")).lower()
    mapping = {
        "negative": "negative", "neutral": "neutral", "positive": "positive",
        "label_0": "negative", "label_1": "neutral", "label_2": "positive",
    }
    return {
        "sentiment": mapping.get(raw_label, raw_label),
        "confidence": float(probabilities[index].item()),
        "model_id": MODEL_ID,
    }
