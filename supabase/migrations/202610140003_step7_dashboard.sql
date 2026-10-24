-- SafeVision Step 7: dashboard views
-- Idempotent and compatible with the summary columns added manually earlier.

alter table public.eval_runs
    add column if not exists accuracy numeric,
    add column if not exists precision_macro numeric,
    add column if not exists recall_macro numeric,
    add column if not exists f1_macro numeric,
    add column if not exists avg_latency_ms numeric,
    add column if not exists total_cost numeric default 0,
    add column if not exists case_count integer,
    add column if not exists result_source text default 'measured';

update public.eval_runs
set result_source = 'measured'
where result_source is null;

create or replace view public.dashboard_product_feedback as
select
    p.id as product_id,
    p.name as product_name,
    p.category,
    count(distinct f.id)::bigint as review_count
from public.products p
left join public.datasets d on d.product_id = p.id
left join public.feedback f on f.dataset_id = d.id
group by p.id, p.name, p.category
order by p.name;

create or replace view public.dashboard_monthly_sentiment as
select
    date_trunc('month', f.created_at)::date as month,
    a.model_name,
    a.sentiment,
    count(*)::bigint as review_count
from public.analyses a
join public.feedback f on f.id = a.feedback_id
where f.created_at is not null
group by 1, 2, 3
order by 1, 2, 3;

create or replace view public.dashboard_latest_eval_runs as
select distinct on (model_name)
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
  and accuracy is not null
order by model_name, completed_at desc;
