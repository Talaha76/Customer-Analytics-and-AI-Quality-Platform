import { getInsightsData } from "../../lib/data";
import styles from "./insights.module.css";

export const dynamic = "force-dynamic";

type IntelligenceType =
  | "theme"
  | "pain_point"
  | "feature_request"
  | "emerging_issue"
  | "recommendation";

type IntelligenceRow = {
  id?: string;
  insight_type: IntelligenceType | string;
  title?: string | null;
  topic?: string | null;
  description?: string | null;
  mention_count?: number | string | null;
  change_pct?: number | string | null;
  confidence?: string | null;
  sentiment?: string | null;
  product_name?: string | null;
  evidence?: any[];
};

type ConsolidatedInsight = IntelligenceRow & {
  displayTitle: string;
  mentionCount: number;
  products: string[];
  evidence: any[];
  duplicateCount: number;
};

const TYPE_META: Record<
  IntelligenceType,
  {
    label: string;
    shortLabel: string;
    description: string;
  }
> = {
  theme: {
    label: "Themes",
    shortLabel: "Themes",
    description:
      "Recurring language patterns found across customer feedback.",
  },
  pain_point: {
    label: "Pain points",
    shortLabel: "Pain points",
    description:
      "Recurring customer friction and dissatisfaction signals.",
  },
  feature_request: {
    label: "Feature requests",
    shortLabel: "Requests",
    description:
      "Capabilities and improvements customers are asking for.",
  },
  emerging_issue: {
    label: "Emerging issues",
    shortLabel: "Emerging",
    description:
      "Signals increasing in the most recent review window.",
  },
  recommendation: {
    label: "Evidence-backed recommendations",
    shortLabel: "Actions",
    description:
      "Product actions supported by aggregated customer evidence.",
  },
};

const TYPE_ORDER: IntelligenceType[] = [
  "theme",
  "pain_point",
  "feature_request",
  "emerging_issue",
  "recommendation",
];

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function titleFor(row: IntelligenceRow) {
  return String(row.title ?? row.topic ?? "Untitled signal").trim();
}

function confidenceRank(value: unknown) {
  switch (normalize(value)) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function consolidateRows(
  rows: IntelligenceRow[],
  type: IntelligenceType
): ConsolidatedInsight[] {
  const matching = rows.filter((row) => row.insight_type === type);

  const grouped = new Map<
    string,
    {
      first: IntelligenceRow;
      rows: IntelligenceRow[];
      products: Set<string>;
      evidence: Map<string, any>;
      productCounts: Map<string, number>;
    }
  >();

  for (const row of matching) {
    const displayTitle = titleFor(row);
    const key = normalize(displayTitle);

    if (!key) continue;

    const existing =
      grouped.get(key) ??
      {
        first: row,
        rows: [],
        products: new Set<string>(),
        evidence: new Map<string, any>(),
        productCounts: new Map<string, number>(),
      };

    existing.rows.push(row);

    const product = String(row.product_name ?? "All products").trim();
    if (product) existing.products.add(product);

    const count = Math.max(0, Number(row.mention_count ?? 0));
    const previous = existing.productCounts.get(product) ?? 0;

    // If the same signal was persisted more than once for the same product,
    // keep the largest count instead of accidentally double counting it.
    existing.productCounts.set(product, Math.max(previous, count));

    for (const review of Array.isArray(row.evidence) ? row.evidence : []) {
      const evidenceKey = String(
        review?.id ??
          `${review?.text ?? ""}-${review?.created_at ?? ""}`
      );

      if (!existing.evidence.has(evidenceKey)) {
        existing.evidence.set(evidenceKey, review);
      }
    }

    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .map(([_, group]) => {
      const strongestConfidence = [...group.rows]
        .map((row) => row.confidence)
        .sort(
          (a, b) => confidenceRank(b) - confidenceRank(a)
        )[0];

      const changes = group.rows
        .map((row) => Number(row.change_pct))
        .filter((value) => Number.isFinite(value));

      const strongestChange =
        changes.length > 0
          ? changes.reduce((best, value) =>
              Math.abs(value) > Math.abs(best) ? value : best
            )
          : null;

      const mentionCount = Array.from(
        group.productCounts.values()
      ).reduce((sum, value) => sum + value, 0);

      return {
        ...group.first,
        displayTitle: titleFor(group.first),
        mentionCount,
        mention_count: mentionCount,
        confidence: strongestConfidence ?? group.first.confidence,
        change_pct: strongestChange,
        products: Array.from(group.products).filter(
          (product) => product !== "All products"
        ),
        evidence: Array.from(group.evidence.values()),
        duplicateCount: group.rows.length,
      };
    })
    .sort((a, b) => {
      if (b.mentionCount !== a.mentionCount) {
        return b.mentionCount - a.mentionCount;
      }

      return a.displayTitle.localeCompare(b.displayTitle);
    });
}

function evidenceList(item: ConsolidatedInsight) {
  if (!item.evidence?.length) return null;

  return (
    <details className={styles.evidence}>
      <summary>
        <span>Supporting evidence</span>
        <span className={styles.evidenceCount}>
          {item.evidence.length} review
          {item.evidence.length === 1 ? "" : "s"}
        </span>
      </summary>

      <div className={styles.evidenceBody}>
        {item.evidence.slice(0, 5).map((review: any, index: number) => (
          <blockquote
            key={
              review?.id ??
              `${item.displayTitle}-evidence-${index}`
            }
          >
            <p>{review?.text ?? "Review text unavailable."}</p>

            <footer>
              {review?.rating != null && (
                <span>{review.rating}/5 rating</span>
              )}
              {review?.source && <span>{review.source}</span>}
            </footer>
          </blockquote>
        ))}
      </div>
    </details>
  );
}

function confidenceLabel(value: unknown) {
  const normalized = normalize(value);

  if (normalized === "high") return "High confidence";
  if (normalized === "medium") return "Medium confidence";
  if (normalized === "low") return "Low confidence";

  return "Confidence unavailable";
}

function SignalCard({
  item,
  type,
}: {
  item: ConsolidatedInsight;
  type: IntelligenceType;
}) {
  const change =
    item.change_pct == null ? null : Number(item.change_pct);

  return (
    <article className={styles.signalCard}>
      <div className={styles.signalCardTop}>
        <span className={`${styles.typePill} ${styles[type]}`}>
          {TYPE_META[type].shortLabel}
        </span>

        <span className={styles.confidence}>
          {confidenceLabel(item.confidence)}
        </span>
      </div>

      <div className={styles.signalMain}>
        <h3>{item.displayTitle}</h3>

        {item.description && <p>{item.description}</p>}
      </div>

      <div className={styles.metricStrip}>
        <div>
          <span className={styles.metricValue}>
            {item.mentionCount.toLocaleString()}
          </span>
          <span className={styles.metricLabel}>mentions</span>
        </div>

        {change != null && Number.isFinite(change) && (
          <div>
            <span
              className={
                change > 0
                  ? styles.negativeMetric
                  : change < 0
                    ? styles.positiveMetric
                    : styles.metricValue
              }
            >
              {change > 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
            <span className={styles.metricLabel}>period change</span>
          </div>
        )}

        {item.products.length > 0 && (
          <div className={styles.productMetric}>
            <span className={styles.metricValue}>
              {item.products.length}
            </span>
            <span className={styles.metricLabel}>
              product{item.products.length === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      {item.products.length > 0 && (
        <div className={styles.productChips}>
          {item.products.slice(0, 3).map((product) => (
            <span key={product}>{product}</span>
          ))}

          {item.products.length > 3 && (
            <span>+{item.products.length - 3}</span>
          )}
        </div>
      )}

      {evidenceList(item)}
    </article>
  );
}

function ThemeTable({
  rows,
}: {
  rows: ConsolidatedInsight[];
}) {
  if (!rows.length) {
    return (
      <div className={styles.emptyState}>
        No theme signals are available yet.
      </div>
    );
  }

  const max = Math.max(
    1,
    ...rows.map((item) => item.mentionCount)
  );

  return (
    <div className={styles.themeList}>
      {rows.slice(0, 10).map((item, index) => {
        const width = Math.max(
          4,
          (item.mentionCount / max) * 100
        );

        return (
          <div
            className={styles.themeRow}
            key={`${normalize(item.displayTitle)}-${index}`}
          >
            <div className={styles.themeRank}>
              {String(index + 1).padStart(2, "0")}
            </div>

            <div className={styles.themeIdentity}>
              <strong>{item.displayTitle}</strong>

              <span>
                {item.products.length
                  ? `${item.products.length} product${
                      item.products.length === 1 ? "" : "s"
                    }`
                  : "Portfolio signal"}
              </span>
            </div>

            <div className={styles.themeBar}>
              <div style={{ width: `${width}%` }} />
            </div>

            <div className={styles.themeCount}>
              <strong>
                {item.mentionCount.toLocaleString()}
              </strong>
              <span>mentions</span>
            </div>

            <div className={styles.themeEvidence}>
              {item.evidence.length > 0 ? (
                <details>
                  <summary>
                    Evidence ({item.evidence.length})
                  </summary>

                  <div className={styles.inlineEvidence}>
                    {item.evidence
                      .slice(0, 3)
                      .map((review: any, evidenceIndex: number) => (
                        <p
                          key={
                            review?.id ??
                            `${item.displayTitle}-${evidenceIndex}`
                          }
                        >
                          “{review?.text ?? "Review unavailable."}”
                        </p>
                      ))}
                  </div>
                </details>
              ) : (
                <span className={styles.noEvidence}>
                  No linked evidence
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function InsightsPage() {
  const rows = (await getInsightsData()) as IntelligenceRow[];

  const groups = Object.fromEntries(
    TYPE_ORDER.map((type) => [
      type,
      consolidateRows(rows, type),
    ])
  ) as Record<IntelligenceType, ConsolidatedInsight[]>;

  const totalSignals = TYPE_ORDER.reduce(
    (sum, type) => sum + groups[type].length,
    0
  );

  const totalEvidence = new Set(
    TYPE_ORDER.flatMap((type) =>
      groups[type].flatMap((item) =>
        item.evidence.map((review: any) => review?.id).filter(Boolean)
      )
    )
  ).size;

  const topPainPoint = groups.pain_point[0];
  const topRecommendation = groups.recommendation[0];

  return (
    <>
      <div className="breadcrumbs">
        <span>AI &amp; Intelligence</span>
        <span>/</span>
        <strong>Insights</strong>
      </div>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            Customer intelligence
          </span>

          <h1>Turn customer feedback into product signals.</h1>

          <p>
            Explore recurring themes, customer pain points,
            feature demand, emerging issues, and evidence-backed
            actions in one structured view.
          </p>
        </div>

        <div className={styles.heroSummary}>
          <div>
            <strong>{totalSignals}</strong>
            <span>unique signals</span>
          </div>

          <div>
            <strong>{totalEvidence}</strong>
            <span>linked reviews</span>
          </div>
        </div>
      </section>

      {!rows.length ? (
        <section className={styles.emptyPanel}>
          <div className={styles.emptyIcon}>✦</div>
          <h2>No customer-intelligence results yet</h2>
          <p>
            Run{" "}
            <span className="mono">
              python -m ai.pipelines.customer_intelligence --write
            </span>{" "}
            from the project root after applying the intelligence
            migration.
          </p>
        </section>
      ) : (
        <>
          <section className={styles.overviewGrid}>
            {TYPE_ORDER.map((type) => (
              <a
                href={`#${type}`}
                className={styles.overviewCard}
                key={type}
              >
                <div
                  className={`${styles.overviewIcon} ${styles[type]}`}
                >
                  {type === "theme"
                    ? "T"
                    : type === "pain_point"
                      ? "!"
                      : type === "feature_request"
                        ? "+"
                        : type === "emerging_issue"
                          ? "↗"
                          : "✓"}
                </div>

                <div>
                  <strong>{groups[type].length}</strong>
                  <span>{TYPE_META[type].label}</span>
                </div>
              </a>
            ))}
          </section>

          <section className={styles.focusGrid}>
            <article className={styles.focusCard}>
              <span>Most frequent pain point</span>

              <strong>
                {topPainPoint?.displayTitle ?? "No pain point detected"}
              </strong>

              <p>
                {topPainPoint
                  ? `${topPainPoint.mentionCount.toLocaleString()} mentions across the current intelligence dataset.`
                  : "Run the intelligence pipeline to populate this signal."}
              </p>
            </article>

            <article className={styles.focusCard}>
              <span>Highest-priority action</span>

              <strong>
                {topRecommendation?.displayTitle ??
                  "No recommendation available"}
              </strong>

              <p>
                {topRecommendation?.description ??
                  "Recommendations appear here once enough evidence is available."}
              </p>
            </article>

            <article className={styles.focusCard}>
              <span>Data quality</span>

              <strong>Duplicates consolidated</strong>

              <p>
                Repeated signal titles are merged in this view, with
                evidence and product coverage combined.
              </p>
            </article>
          </section>

          <section
            className={styles.section}
            id="theme"
          >
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>
                  Language patterns
                </span>
                <h2>Top themes</h2>
                <p>
                  TF-IDF-derived terms ranked by customer mention
                  volume. Repeated titles are consolidated before
                  display.
                </p>
              </div>

              <span className={styles.sectionCount}>
                {groups.theme.length} unique
              </span>
            </div>

            <div className={styles.themePanel}>
              <ThemeTable rows={groups.theme} />
            </div>
          </section>

          <section className={styles.twoColumn}>
            <div
              className={styles.section}
              id="pain_point"
            >
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.sectionEyebrow}>
                    Customer friction
                  </span>
                  <h2>Pain points</h2>
                  <p>
                    Repeated customer problems that may require
                    product or service attention.
                  </p>
                </div>

                <span className={styles.sectionCount}>
                  {groups.pain_point.length}
                </span>
              </div>

              <div className={styles.cardStack}>
                {groups.pain_point.slice(0, 6).map((item) => (
                  <SignalCard
                    item={item}
                    type="pain_point"
                    key={normalize(item.displayTitle)}
                  />
                ))}
              </div>
            </div>

            <div
              className={styles.section}
              id="feature_request"
            >
              <div className={styles.sectionHeader}>
                <div>
                  <span className={styles.sectionEyebrow}>
                    Customer demand
                  </span>
                  <h2>Feature requests</h2>
                  <p>
                    Product capabilities customers are asking to add
                    or improve.
                  </p>
                </div>

                <span className={styles.sectionCount}>
                  {groups.feature_request.length}
                </span>
              </div>

              <div className={styles.cardStack}>
                {groups.feature_request
                  .slice(0, 6)
                  .map((item) => (
                    <SignalCard
                      item={item}
                      type="feature_request"
                      key={normalize(item.displayTitle)}
                    />
                  ))}
              </div>
            </div>
          </section>

          <section
            className={styles.section}
            id="emerging_issue"
          >
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>
                  Trend monitoring
                </span>
                <h2>Emerging issues</h2>
                <p>
                  Signals showing meaningful recent movement compared
                  with the previous review window.
                </p>
              </div>

              <span className={styles.sectionCount}>
                {groups.emerging_issue.length}
              </span>
            </div>

            {groups.emerging_issue.length ? (
              <div className={styles.emergingGrid}>
                {groups.emerging_issue
                  .slice(0, 6)
                  .map((item) => (
                    <SignalCard
                      item={item}
                      type="emerging_issue"
                      key={normalize(item.displayTitle)}
                    />
                  ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                No emerging issue currently meets the detection
                threshold.
              </div>
            )}
          </section>

          <section
            className={styles.section}
            id="recommendation"
          >
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>
                  Recommended actions
                </span>
                <h2>Evidence-backed recommendations</h2>
                <p>
                  Prioritized product actions linked directly to the
                  customer evidence supporting them.
                </p>
              </div>

              <span className={styles.sectionCount}>
                {groups.recommendation.length}
              </span>
            </div>

            <div className={styles.recommendationGrid}>
              {groups.recommendation
                .slice(0, 8)
                .map((item, index) => (
                  <article
                    className={styles.recommendationCard}
                    key={normalize(item.displayTitle)}
                  >
                    <div className={styles.recommendationRank}>
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className={styles.recommendationContent}>
                      <div className={styles.recommendationTop}>
                        <span>Recommended action</span>
                        <span>
                          {confidenceLabel(item.confidence)}
                        </span>
                      </div>

                      <h3>{item.displayTitle}</h3>

                      {item.description && <p>{item.description}</p>}

                      <div className={styles.recommendationMeta}>
                        <span>
                          <strong>
                            {item.mentionCount.toLocaleString()}
                          </strong>{" "}
                          supporting mentions
                        </span>

                        <span>
                          <strong>{item.evidence.length}</strong>{" "}
                          linked reviews
                        </span>
                      </div>

                      {evidenceList(item)}
                    </div>
                  </article>
                ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
