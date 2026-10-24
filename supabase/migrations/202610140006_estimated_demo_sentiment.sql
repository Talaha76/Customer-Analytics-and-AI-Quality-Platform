-- Senvu demo-only sentiment rows for models that have not been executed locally.
-- IMPORTANT: these rows are ESTIMATED/SYNTHETIC and are only for dashboard visualization.
-- They must not be described as measured benchmark results.
-- Safe to rerun.

create unique index if not exists uq_analyses_feedback_model_prompt
    on public.analyses (feedback_id, model_name, prompt_version);

delete from public.analyses
where prompt_version = 'estimated-demo-v1'
  and model_name in ('RoBERTa', 'DistilBERT', 'OpenAI Structured');

with model_specs(model_name, alignment_pct, base_confidence, latency_ms, estimated_cost) as (
    values
        ('RoBERTa'::text, 84::int, 0.84::numeric, 28.5::numeric, 0::numeric),
        ('DistilBERT'::text, 79::int, 0.80::numeric, 16.8::numeric, 0::numeric),
        ('OpenAI Structured'::text, 91::int, 0.91::numeric, 620::numeric, 0.0005::numeric)
),
base as (
    select
        f.id as feedback_id,
        coalesce(
            (
                select a.sentiment
                from public.analyses a
                where a.feedback_id = f.id
                  and a.model_name = 'VADER'
                  and a.sentiment in ('positive', 'neutral', 'negative')
                order by a.created_at desc
                limit 1
            ),
            case
                when f.rating >= 4 then 'positive'
                when f.rating <= 2 then 'negative'
                else 'neutral'
            end
        ) as anchor_sentiment
    from public.feedback f
),
scored as (
    select
        b.feedback_id,
        b.anchor_sentiment,
        m.*,
        (
          (('x' || substr(md5(b.feedback_id::text || ':' || m.model_name), 1, 8))::bit(32)::bigint) % 100
        )::int as keep_roll,
        (
          (('x' || substr(md5('shift:' || b.feedback_id::text || ':' || m.model_name), 1, 8))::bit(32)::bigint) % 2
        )::int as shift_roll,
        (
          (('x' || substr(md5('confidence:' || b.feedback_id::text || ':' || m.model_name), 1, 8))::bit(32)::bigint) % 8
        )::int as confidence_roll
    from base b
    cross join model_specs m
)
insert into public.analyses (
    feedback_id,
    model_name,
    prompt_version,
    sentiment,
    sentiment_confidence,
    topics,
    pain_points,
    feature_requests,
    severity,
    churn_signal,
    recommendation,
    latency_ms,
    estimated_cost,
    created_at
)
select
    feedback_id,
    model_name,
    'estimated-demo-v1',
    case
        when keep_roll < alignment_pct then anchor_sentiment
        when anchor_sentiment = 'positive' and shift_roll = 0 then 'neutral'
        when anchor_sentiment = 'positive' and shift_roll = 1 then 'negative'
        when anchor_sentiment = 'neutral' and shift_roll = 0 then 'positive'
        when anchor_sentiment = 'neutral' and shift_roll = 1 then 'negative'
        when anchor_sentiment = 'negative' and shift_roll = 0 then 'neutral'
        else 'positive'
    end as sentiment,
    least(0.98::numeric, base_confidence + confidence_roll * 0.01) as sentiment_confidence,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    null,
    null,
    latency_ms,
    estimated_cost,
    now()
from scored
on conflict (feedback_id, model_name, prompt_version)
do update set
    sentiment = excluded.sentiment,
    sentiment_confidence = excluded.sentiment_confidence,
    latency_ms = excluded.latency_ms,
    estimated_cost = excluded.estimated_cost,
    created_at = now();

notify pgrst, 'reload schema';

-- Verification: should return 1,200 rows per model when the database contains 1,200 feedback rows.
select
    model_name,
    prompt_version,
    count(*) as analysis_rows,
    count(*) filter (where sentiment = 'positive') as positive,
    count(*) filter (where sentiment = 'neutral') as neutral,
    count(*) filter (where sentiment = 'negative') as negative
from public.analyses
where prompt_version = 'estimated-demo-v1'
group by model_name, prompt_version
order by model_name;
