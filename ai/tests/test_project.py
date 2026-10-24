from ai.pipelines.normalize import clean_text, normalize_record
from ai.pipelines.ingest import ingest_records
from pathlib import Path
import json

def test_clean_text(): assert clean_text('  hello   world ')=='hello world'
def test_normalize(): assert normalize_record({'review':' Good '})['text']=='Good'
def test_eval_count():
    p=Path('ai/evals/test_cases.jsonl'); assert len([x for x in p.read_text().splitlines() if x.strip()])==100
def test_failure_categories():
    rows=[json.loads(x) for x in Path('ai/evals/test_cases.jsonl').read_text().splitlines() if x.strip()]
    assert len(set(r['failure_mode'] for r in rows))==20
