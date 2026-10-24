-- Phase 4: baseline NLP metrics
-- Adds confidence so VADER/TextBlob can persist both prediction and confidence.

alter table public.analyses
    add column if not exists sentiment_confidence numeric;

alter table public.analyses
    drop constraint if exists analyses_sentiment_confidence_range;

alter table public.analyses
    add constraint analyses_sentiment_confidence_range
    check (
        sentiment_confidence is null
        or (sentiment_confidence >= 0 and sentiment_confidence <= 1)
    );

create unique index if not exists uq_analyses_feedback_model_prompt
    on public.analyses (feedback_id, model_name, prompt_version);
