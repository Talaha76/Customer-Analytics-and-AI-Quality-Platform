import { createAdminClient } from "./supabase-admin";

export type EvalRun = {
  id: string;
  model_name: string;
  prompt_version: string | null;
  rubric_version: string | null;
  accuracy: number | null;
  precision_macro: number | null;
  recall_macro: number | null;
  f1_macro: number | null;
  avg_latency_ms: number | null;
  total_cost: number | null;
  case_count: number | null;
  result_source: string | null;
  started_at?: string | null;
  completed_at: string | null;
};

type DashboardFilters = {
  product?: string;
  days?: string;
  sentiment?: string;
  rating?: string;
  source?: string;
  model?: string;
  q?: string;
};

const MODEL_ORDER = [
  "VADER",
  "TextBlob",
  "RoBERTa",
  "DistilBERT",
  "OpenAI Structured",
];

function relationValue(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function productName(row: any): string {
  const dataset = relationValue(row.datasets);
  const product = relationValue(dataset?.products);
  return product?.name ?? "Unknown product";
}

function analysisFor(row: any, model: string) {
  const analyses = Array.isArray(row.analyses) ? row.analyses : [];
  return analyses.find((analysis: any) => analysis.model_name === model) ?? null;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

type ThemeStat = {
  name: string;
  count: number;
  sentiment: string;
};

const BLOCKED_THEME_NAMES = new Set([
  "expected",
  "special",
  "excellent",
  "good",
  "great",
  "bad",
  "nice",
  "love",
  "like",
  "really",
  "thing",
  "things",
  "product",
  "products",
  "works",
  "work",
  "use",
  "using",
  "used",
  "better",
  "best",
  "new",
]);

function normalizeThemeName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function formatThemeName(value: string): string {
  return value
    .split(" ")
    .map((word) =>
      word.length > 0
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word
    )
    .join(" ");
}

function aggregateThemeStats(
  intelligenceRows: any[],
  limit = 6
): ThemeStat[] {
  const grouped = new Map<
    string,
    {
      name: string;
      count: number;
      positive: number;
      neutral: number;
      negative: number;
    }
  >();

  for (const row of intelligenceRows) {
    if (row.insight_type !== "theme") {
      continue;
    }

    const rawName = row.topic ?? row.title;
    const normalizedName = normalizeThemeName(rawName);

    // Ignore missing or very weak theme labels.
    if (!normalizedName) {
      continue;
    }

    if (normalizedName.length < 3) {
      continue;
    }

    if (BLOCKED_THEME_NAMES.has(normalizedName)) {
      continue;
    }

    const count = Math.max(
      0,
      Number(row.mention_count ?? 0)
    );

    if (count <= 0) {
      continue;
    }

    const sentiment =
      row.sentiment === "positive" ||
      row.sentiment === "negative" ||
      row.sentiment === "neutral"
        ? row.sentiment
        : "neutral";

    const existing = grouped.get(normalizedName) ?? {
      name: formatThemeName(normalizedName),
      count: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    existing.count += count;

    if (sentiment === "positive") {
      existing.positive += count;
    } else if (sentiment === "negative") {
      existing.negative += count;
    } else {
      existing.neutral += count;
    }

    grouped.set(normalizedName, existing);
  }

  return Array.from(grouped.values())
    .map((theme) => {
      let sentiment = "neutral";

      // Only call something positive/negative if that direction
      // clearly has the largest weighted count.
      if (
        theme.positive > theme.negative &&
        theme.positive > theme.neutral
      ) {
        sentiment = "positive";
      } else if (
        theme.negative > theme.positive &&
        theme.negative > theme.neutral
      ) {
        sentiment = "negative";
      }

      return {
        name: theme.name,
        count: theme.count,
        sentiment,
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}


async function fetchFeedbackRows() {
  const supabase = createAdminClient();
  const rows: any[] = [];
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const result = await supabase
      .from("feedback")
      .select(`
        id,text,rating,source,created_at,dataset_id,
        datasets(products(id,name,category)),
        analyses(id,model_name,prompt_version,sentiment,sentiment_confidence,topics,pain_points,feature_requests,severity,churn_signal,recommendation,created_at)
      `)
      .order("created_at", { ascending: false })
      .range(start, start + pageSize - 1);

    if (result.error) throw new Error(result.error.message);

    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function persistedInsights(product?: string) {
  const supabase = createAdminClient();
  const result = await supabase
    .from("customer_insights")
    .select("*,products(name)")
    .order("mention_count", { ascending: false })
    .limit(100);

  if (result.error) throw new Error(result.error.message);

  return (result.data ?? []).filter(
    (row: any) => !product || relationValue(row.products)?.name === product
  );
}

export async function getOverviewData(filters: DashboardFilters = {}) {
  const supabase = createAdminClient();

  const [rows, analysesCount, evalCases, evalRuns, intelligence] =
    await Promise.all([
      fetchFeedbackRows(),
      supabase.from("analyses").select("*", { count: "exact", head: true }),
      supabase
        .from("eval_test_cases")
        .select("*", { count: "exact", head: true }),
      supabase.from("dashboard_latest_eval_runs").select("*"),
      persistedInsights(
        filters.product && filters.product !== "all"
          ? filters.product
          : undefined
      ).catch(() => []),
    ]);

  const errors = [analysesCount.error, evalCases.error, evalRuns.error].filter(
    Boolean
  );
  if (errors.length) {
    throw new Error(errors.map((error) => error?.message).join(" | "));
  }

  const runs = (evalRuns.data ?? []) as EvalRun[];
  const analysisModels = rows.flatMap((row: any) =>
    (row.analyses ?? [])
      .map((analysis: any) => analysis.model_name)
      .filter(Boolean)
  );
  const summaryModels = runs.map((run) => run.model_name).filter(Boolean);
  const modelSet = new Set<string>([...analysisModels, ...summaryModels]);
  const availableModels = [
    ...MODEL_ORDER.filter((model) => modelSet.has(model)),
    ...Array.from(modelSet)
      .filter((model) => !MODEL_ORDER.includes(model))
      .sort(),
  ];

  const model =
    filters.model && availableModels.includes(filters.model)
      ? filters.model
      : availableModels.includes("VADER")
        ? "VADER"
        : availableModels[0] ?? "VADER";

  const selectedAnalyses = rows
    .map((row: any) => analysisFor(row, model))
    .filter(Boolean);
  const selectedModelCoverage = selectedAnalyses.length;
  const hasRealPerReviewOutput = selectedAnalyses.some(
    (analysis: any) =>
      !String(analysis.prompt_version ?? "").startsWith("estimated-demo")
  );
  const hasEstimatedPerReviewOutput = selectedAnalyses.some((analysis: any) =>
    String(analysis.prompt_version ?? "").startsWith("estimated-demo")
  );
  const summaryRun = runs.find((run) => run.model_name === model);
  const selectedModelSource =
    hasEstimatedPerReviewOutput && !hasRealPerReviewOutput
      ? "estimated"
      : summaryRun?.result_source ?? "measured";

  const allProducts = Array.from(
    new Set<string>(rows.map((row: any) => productName(row)))
  ).sort();
  const allSources = Array.from(
    new Set(rows.map((row: any) => row.source).filter(Boolean))
  ).sort() as string[];

  const dates = rows
    .map((row: any) => row.created_at && new Date(row.created_at))
    .filter(
      (date: Date | null) => date && !Number.isNaN(date.getTime())
    ) as Date[];
  const anchor = dates.length
    ? new Date(Math.max(...dates.map((date) => date.getTime())))
    : new Date();
  const days = filters.days === "all" ? null : Number(filters.days ?? 30);
  const cutoff =
    days && Number.isFinite(days)
      ? new Date(anchor.getTime() - (days - 1) * 86400000)
      : null;

  function baseMatches(row: any, includeDate = true) {
    if (
      filters.product &&
      filters.product !== "all" &&
      productName(row) !== filters.product
    )
      return false;
    if (
      filters.rating &&
      filters.rating !== "all" &&
      Number(row.rating) !== Number(filters.rating)
    )
      return false;
    if (
      filters.source &&
      filters.source !== "all" &&
      row.source !== filters.source
    )
      return false;
    if (
      filters.q &&
      !String(row.text ?? "")
        .toLowerCase()
        .includes(filters.q.toLowerCase())
    )
      return false;

    const analysis = analysisFor(row, model);
    if (
      filters.sentiment &&
      filters.sentiment !== "all" &&
      analysis?.sentiment !== filters.sentiment
    )
      return false;
    if (includeDate && cutoff && row.created_at) {
      if (new Date(row.created_at) < cutoff) return false;
    }
    return true;
  }

  const filtered = rows.filter((row: any) => baseMatches(row, true));
  const numericRatings = filtered
    .map((row: any) => Number(row.rating))
    .filter((rating: number) => Number.isFinite(rating) && rating > 0);
  const averageRating = numericRatings.length
    ? numericRatings.reduce(
        (sum: number, rating: number) => sum + rating,
        0
      ) / numericRatings.length
    : null;

  const sentiments = { positive: 0, neutral: 0, negative: 0 };
  for (const row of filtered) {
    const sentiment = analysisFor(row, model)?.sentiment;
    if (sentiment in sentiments) {
      sentiments[sentiment as keyof typeof sentiments] += 1;
    }
  }

  const sentimentTotal =
    sentiments.positive + sentiments.neutral + sentiments.negative;
  const sentimentScore = sentimentTotal
    ? ((sentiments.positive - sentiments.negative) / sentimentTotal) * 100
    : 0;
  const positivePct = sentimentTotal
    ? (sentiments.positive / sentimentTotal) * 100
    : 0;
  const negativePct = sentimentTotal
    ? (sentiments.negative / sentimentTotal) * 100
    : 0;

  let periodChange: number | null = null;
  if (days && cutoff) {
    const previousStart = new Date(cutoff.getTime() - days * 86400000);
    const currentCount = rows.filter(
      (row: any) =>
        baseMatches(row, false) &&
        row.created_at &&
        new Date(row.created_at) >= cutoff &&
        new Date(row.created_at) <= anchor
    ).length;
    const previousCount = rows.filter(
      (row: any) =>
        baseMatches(row, false) &&
        row.created_at &&
        new Date(row.created_at) >= previousStart &&
        new Date(row.created_at) < cutoff
    ).length;
    if (previousCount > 0) {
      periodChange = ((currentCount - previousCount) / previousCount) * 100;
    }
  }

  const ratingDistribution: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (const rating of numericRatings) {
    ratingDistribution[Math.max(1, Math.min(5, Math.round(rating)))] += 1;
  }

  const monthly = new Map<
    string,
    { positive: number; neutral: number; negative: number }
  >();
  for (const row of filtered) {
    if (!row.created_at) continue;
    const label = dateLabel(row.created_at);
    const current = monthly.get(label) ?? {
      positive: 0,
      neutral: 0,
      negative: 0,
    };
    const sentiment = analysisFor(row, model)?.sentiment;
    if (sentiment === "positive") {
  current.positive += 1;
} else if (sentiment === "neutral") {
  current.neutral += 1;
} else if (sentiment === "negative") {
  current.negative += 1;
}
    monthly.set(label, current);
  }

  const monthOrder = Array.from(
    new Set<string>(
      filtered
        .filter((row: any) => row.created_at)
        .map((row: any) => new Date(row.created_at))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime())
        .map((date: Date) =>
          date.toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
          })
        )
    )
  );
  const trendPoints = monthOrder.map((month) => ({
    month,
    ...(monthly.get(month) ?? { positive: 0, neutral: 0, negative: 0 }),
  }));

  const productMap = new Map<
    string,
    {
      reviewCount: number;
      ratingSum: number;
      ratingCount: number;
      positive: number;
      negative: number;
    }
  >();
  for (const row of filtered) {
    const name = productName(row);
    const current = productMap.get(name) ?? {
      reviewCount: 0,
      ratingSum: 0,
      ratingCount: 0,
      positive: 0,
      negative: 0,
    };
    current.reviewCount += 1;
    const rating = Number(row.rating);
    if (Number.isFinite(rating) && rating > 0) {
      current.ratingSum += rating;
      current.ratingCount += 1;
    }
    const sentiment = analysisFor(row, model)?.sentiment;
    if (sentiment === "positive") current.positive += 1;
    if (sentiment === "negative") current.negative += 1;
    productMap.set(name, current);
  }

  const productStats = Array.from(productMap.entries())
    .map(([name, stats]) => ({
      name,
      reviewCount: stats.reviewCount,
      averageRating: stats.ratingCount
        ? stats.ratingSum / stats.ratingCount
        : null,
      sentimentScore:
        stats.positive + stats.negative
          ? ((stats.positive - stats.negative) /
              (stats.positive + stats.negative)) *
            100
          : 0,
      positivePct: stats.reviewCount
        ? (stats.positive / stats.reviewCount) * 100
        : 0,
    }))
    .sort(
      (a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0)
    );

  const recentReviews = filtered.slice(0, 8).map((row: any) => ({
    id: row.id,
    text: row.text,
    rating: row.rating,
    source: row.source,
    created_at: row.created_at,
    product: productName(row),
    sentiment: analysisFor(row, model)?.sentiment ?? "unknown",
  }));

  const measuredRuns = runs.filter(
    (run) => (run.result_source ?? "measured") === "measured"
  );
  const bestMeasuredRun = [...measuredRuns]
    .filter((run) => run.f1_macro !== null)
    .sort((a, b) => Number(b.f1_macro) - Number(a.f1_macro))[0];

  let insights = (intelligence as any[])
    .filter((row) =>
      ["recommendation", "emerging_issue", "pain_point"].includes(
        row.insight_type
      )
    )
    .slice(0, 4)
    .map((row) => row.description);

  if (!insights.length) {
    insights = [];
    if (productStats[0]?.averageRating != null) {
      insights.push(
        `${productStats[0].name} has the strongest average rating at ${productStats[0].averageRating.toFixed(2)} out of 5 in the current view.`
      );
    }
    if (sentimentTotal) {
      insights.push(
        `${positivePct.toFixed(1)}% of ${model} classifications are positive, compared with ${negativePct.toFixed(1)}% negative.`
      );
    }
    if (bestMeasuredRun?.f1_macro != null) {
      insights.push(
        `${bestMeasuredRun.model_name} is the strongest measured baseline at ${(Number(bestMeasuredRun.f1_macro) * 100).toFixed(1)}% macro F1.`
      );
    }
  }

  const themeStats = aggregateThemeStats(
  intelligence as any[],
  6
    );

  return {
    reviewCount: filtered.length,
    totalReviewCount: rows.length,
    analysisCount: analysesCount.count ?? 0,
    evalCaseCount: evalCases.count ?? 0,
    averageRating,
    sentiments,
    sentimentScore,
    positivePct,
    negativePct,
    periodChange,
    ratingDistribution,
    trendPoints,
    productStats,
    themeStats,
    recentReviews,
    evalRuns: runs,
    measuredRuns,
    bestMeasuredRun,
    insights,
    products: allProducts,
    sources: allSources,
    models: availableModels,
    selectedModel: model,
    selectedModelSource,
    selectedModelCoverage,
    anchorDate: anchor,
  };
}

export async function getReviewsData(q = "", product?: string) {
  const rows = await fetchFeedbackRows();
  return rows
    .filter(
      (row: any) =>
        (!q ||
          String(row.text ?? "")
            .toLowerCase()
            .includes(q.toLowerCase())) &&
        (!product || productName(row) === product)
    )
    .slice(0, 300)
    .map((row: any) => ({
      id: row.id,
      text: row.text,
      rating: row.rating,
      source: row.source,
      created_at: row.created_at,
      product: productName(row),
      analyses: row.analyses ?? [],
    }));
}

export async function getEvalRuns() {
  const supabase = createAdminClient();
  const result = await supabase
    .from("dashboard_latest_eval_runs")
    .select("*");
  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as EvalRun[]).sort(
    (a, b) => Number(b.f1_macro ?? 0) - Number(a.f1_macro ?? 0)
  );
}

export async function getInsightsData(product?: string) {
  const supabase = createAdminClient();
  const rows = await persistedInsights(product);
  const evidenceIds = Array.from(
    new Set(
      rows.flatMap((row: any) =>
        Array.isArray(row.evidence_feedback_ids)
          ? row.evidence_feedback_ids
          : []
      )
    )
  ).slice(0, 200);

  let evidenceRows: any[] = [];
  if (evidenceIds.length) {
    const response = await supabase
      .from("feedback")
      .select("id,text,rating,source,created_at,dataset_id")
      .in("id", evidenceIds);
    if (response.error) throw new Error(response.error.message);
    evidenceRows = response.data ?? [];
  }

  const evidenceMap = new Map(
    evidenceRows.map((row: any) => [row.id, row])
  );
  return rows.map((row: any) => ({
    ...row,
    product_name: relationValue(row.products)?.name ?? "All products",
    evidence: (
      Array.isArray(row.evidence_feedback_ids)
        ? row.evidence_feedback_ids
        : []
    )
      .map((id: string) => evidenceMap.get(id))
      .filter(Boolean),
  }));
}

export async function getProductDetail(name: string) {
  const [overview, insights, reviews] = await Promise.all([
    getOverviewData({ product: name, days: "all" }),
    getInsightsData(name),
    getReviewsData("", name),
  ]);
  return { overview, insights, reviews: reviews.slice(0, 12) };
}

export async function getHumanReviewQueue() {
  const supabase = createAdminClient();
  const [rows, labels] = await Promise.all([
    fetchFeedbackRows(),
    supabase
      .from("human_labels")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  if (labels.error) throw new Error(labels.error.message);

  const latest = new Map<string, any>();
  for (const label of labels.data ?? []) {
    if (!latest.has((label as any).feedback_id)) {
      latest.set((label as any).feedback_id, label);
    }
  }

  return rows.slice(0, 200).map((row: any) => ({
    id: row.id,
    text: row.text,
    rating: row.rating,
    source: row.source,
    product: productName(row),
    analyses: row.analyses ?? [],
    reviewed: latest.has(row.id),
    latestLabel: latest.get(row.id) ?? null,
  }));
}

export async function getAdvancedEvalData() {
  const supabase = createAdminClient();
  const [latestRuns, historyResp] = await Promise.all([
    getEvalRuns(),
    supabase
      .from("eval_runs")
      .select("*")
      .not("completed_at", "is", null)
      .not("f1_macro", "is", null)
      .order("completed_at", { ascending: true }),
  ]);
  if (historyResp.error) throw new Error(historyResp.error.message);

  const history = (historyResp.data ?? []) as EvalRun[];
  const measuredLatest = latestRuns.filter(
    (run) => (run.result_source ?? "measured") === "measured"
  );
  const runIds = measuredLatest.map((run) => run.id);

  let scores: any[] = [];
  if (runIds.length) {
    const scoreResp = await supabase
      .from("eval_scores")
      .select(
        "eval_run_id,test_case_id,expected_sentiment,predicted_sentiment,is_correct,score_total,eval_test_cases(failure_mode)"
      )
      .in("eval_run_id", runIds);
    if (scoreResp.error) throw new Error(scoreResp.error.message);
    scores = scoreResp.data ?? [];
  }

  const failureModes: any[] = [];
  const confusion: Record<
    string,
    Record<string, Record<string, number>>
  > = {};

  for (const run of measuredLatest) {
    const runScores = scores.filter(
      (score: any) =>
        score.eval_run_id === run.id &&
        score.is_correct !== null &&
        score.is_correct !== undefined
    );
    const groups = new Map<string, { cases: number; passed: number }>();
    confusion[run.model_name] = {
      positive: { positive: 0, neutral: 0, negative: 0 },
      neutral: { positive: 0, neutral: 0, negative: 0 },
      negative: { positive: 0, neutral: 0, negative: 0 },
    };

    for (const score of runScores) {
      const testCase: any = relationValue(score.eval_test_cases);
      const mode = testCase?.failure_mode ?? "unknown";
      const group = groups.get(mode) ?? { cases: 0, passed: 0 };
      group.cases += 1;
      if (score.is_correct) group.passed += 1;
      groups.set(mode, group);

      if (
        score.expected_sentiment &&
        score.predicted_sentiment &&
        confusion[run.model_name][score.expected_sentiment]?.[
          score.predicted_sentiment
        ] !== undefined
      ) {
        confusion[run.model_name][score.expected_sentiment][
          score.predicted_sentiment
        ] += 1;
      }
    }

    for (const [failureMode, group] of groups.entries()) {
      failureModes.push({
        model: run.model_name,
        failureMode,
        cases: group.cases,
        passed: group.passed,
        passRate: group.cases ? group.passed / group.cases : 0,
      });
    }
  }

  const agreementPairs: any[] = [];
  for (let i = 0; i < measuredLatest.length; i += 1) {
    for (let j = i + 1; j < measuredLatest.length; j += 1) {
      const a = measuredLatest[i];
      const b = measuredLatest[j];
      const aMap = new Map(
        scores
          .filter(
            (score: any) =>
              score.eval_run_id === a.id && score.predicted_sentiment
          )
          .map((score: any) => [score.test_case_id, score.predicted_sentiment])
      );
      const bMap = new Map(
        scores
          .filter(
            (score: any) =>
              score.eval_run_id === b.id && score.predicted_sentiment
          )
          .map((score: any) => [score.test_case_id, score.predicted_sentiment])
      );

      let overlap = 0;
      let agree = 0;
      for (const [id, prediction] of aMap.entries()) {
        if (bMap.has(id)) {
          overlap += 1;
          if (bMap.get(id) === prediction) agree += 1;
        }
      }
      if (overlap) {
        agreementPairs.push({
          a: a.model_name,
          b: b.model_name,
          overlap,
          agreement: agree / overlap,
        });
      }
    }
  }

  const regression = Array.from(
    new Set(
      history
        .filter(
          (run) => (run.result_source ?? "measured") === "measured"
        )
        .map((run) => run.model_name)
    )
  ).map((model) => {
    const runs = history
      .filter(
        (run) =>
          run.model_name === model &&
          (run.result_source ?? "measured") === "measured"
      )
      .sort(
        (a, b) =>
          new Date(a.completed_at ?? 0).getTime() -
          new Date(b.completed_at ?? 0).getTime()
      );
    const latest = runs[runs.length - 1];
    const previous = runs[runs.length - 2];
    return {
      model,
      latest,
      previous,
      delta:
        previous && latest
          ? Number(latest.f1_macro ?? 0) - Number(previous.f1_macro ?? 0)
          : null,
      points: runs.map((run, index) => ({
        label: `Run ${index + 1}`,
        value: Number(run.f1_macro ?? 0),
      })),
    };
  });

  return {
    latestRuns,
    measuredLatest,
    history,
    failureModes,
    confusion,
    agreementPairs,
    regression,
    caseLevelAvailable: scores.some(
      (score: any) => score.predicted_sentiment && score.expected_sentiment
    ),
  };
}
