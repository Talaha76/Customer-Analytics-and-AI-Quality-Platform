# SafeVision AI Step-by-Step Build Guide

## Phase 0 — Audit
Preserve the useful legacy ETL, labeling, disagreement, PostgreSQL, and Streamlit logic. See `CURRENT_STATE.md`.

## Phase 1 — Local validation
```bash
python -m venv .venv
# activate it
pip install -r requirements.txt
pytest -q
python -m ai.pipelines.ingest sample_data/legacy_feedback.csv
```
Expected ETL dry-run: 1,200 rows received/accepted for the supplied legacy file.

## Phase 2 — Supabase/PostgreSQL
Create a free Supabase project. Run `supabase/migrations/202610030001_initial_schema.sql`, then `supabase/seed.sql`. This creates organizations, products, datasets, feedback, analyses, human_labels, eval_test_cases, eval_runs, and eval_scores.

## Phase 3 — Ingestion
Use `ai/pipelines/ingest.py` to validate and normalize CSV/JSON/JSONL. Extend it with Supabase writes after credentials are configured.

## Phase 4 — Free NLP baselines
```bash
python -m ai.evals.run_evals --approach vader
python -m ai.evals.run_evals --approach textblob
```
These are local and cost $0.

## Phase 5 — Four-approach comparison
Keep VADER and TextBlob, then add two free/local transformer approaches (for example DistilBERT and RoBERTa) or deliberately enable hosted LLMs later. Do not claim four-model metrics until all four have actually run.

## Phase 6 — Dashboard
The `web/` folder is the Next.js starter. Connect it to Supabase and populate Overview, Feedback, Trends, Recommendations, Evals, and Human Review pages.

## Phase 7 — Deployment
Use Supabase Free for hosted PostgreSQL and Vercel Hobby for the Next.js app. Keep hosted paid AI APIs disabled unless you deliberately choose to use them.

## Resume goals
Only claim measured results:
- 1,000+ reviews analyzed
- 100+ failure tests/custom rubric/4 approaches
- Python ETL + Supabase + human-in-the-loop review
- Next.js dashboard with 6+ quality metrics, regressions, trends, and emerging issues
