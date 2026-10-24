-- SafeVision Steps 8-10: Human Review, Customer Intelligence, Advanced Evals
-- Safe to rerun.

alter table public.human_labels
    add column if not exists analysis_id uuid references public.analyses(id) on delete set null,
    add column if not exists corrected_severity text,
    add column if not exists corrected_pain_points jsonb default '[]'::jsonb,
    add column if not exists corrected_feature_requests jsonb default '[]'::jsonb,
    add column if not exists corrected_recommendation text,
    add column if not exists review_status text default 'reviewed',
    add column if not exists updated_at timestamptz default now();

alter table public.eval_scores
    add column if not exists expected_sentiment text,
    add column if not exists predicted_sentiment text,
    add column if not exists is_correct boolean;

alter table public.eval_runs
    add column if not exists accuracy numeric,
    add column if not exists precision_macro numeric,
    add column if not exists recall_macro numeric,
    add column if not exists f1_macro numeric,
    add column if not exists avg_latency_ms numeric,
    add column if not exists total_cost numeric default 0,
    add column if not exists case_count integer,
    add column if not exists result_source text default 'measured';

create table if not exists public.customer_insights (
    id uuid primary key default gen_random_uuid(),
    product_id uuid references public.products(id) on delete cascade,
    insight_type text not null,
    title text not null,
    description text not null,
    topic text,
    sentiment text,
    mention_count integer default 0,
    current_share numeric,
    previous_share numeric,
    change_pct numeric,
    confidence text,
    evidence_feedback_ids jsonb default '[]'::jsonb,
    method text not null default 'tfidf-rules-v1',
    created_at timestamptz default now()
);

create index if not exists idx_customer_insights_product
    on public.customer_insights(product_id);
create index if not exists idx_customer_insights_type
    on public.customer_insights(insight_type);
create index if not exists idx_human_labels_feedback_created
    on public.human_labels(feedback_id, created_at desc);
create index if not exists idx_eval_scores_case_prediction
    on public.eval_scores(eval_run_id, test_case_id, predicted_sentiment);

create or replace view public.dashboard_eval_history as
select
    id,
    model_name,
    prompt_version,
    rubric_version,
    accuracy,
    precision_macro,
    recall_macro,
    f1_macro,
    avg_latency_ms,
    total_cost,
    case_count,
    coalesce(result_source, 'measured') as result_source,
    started_at,
    completed_at
from public.eval_runs
where completed_at is not null
  and f1_macro is not null
order by completed_at asc;

create or replace view public.dashboard_failure_modes as
select
    es.eval_run_id,
    er.model_name,
    er.completed_at,
    tc.failure_mode,
    count(*)::integer as case_count,
    sum(case when es.is_correct then 1 else 0 end)::integer as passed_cases,
    avg(case when es.is_correct then 1.0 else 0.0 end)::numeric as pass_rate
from public.eval_scores es
join public.eval_runs er on er.id = es.eval_run_id
join public.eval_test_cases tc on tc.id = es.test_case_id
where es.is_correct is not null
  and er.completed_at is not null
group by es.eval_run_id, er.model_name, er.completed_at, tc.failure_mode;

notify pgrst, 'reload schema';
