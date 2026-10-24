import Link from "next/link";
import FilterBar from "../../components/FilterBar";
import ExportReportButton from "../../components/ExportReportButton";
import Icon from "../../components/Icon";
import {
  RatingDistribution,
  SentimentBreakdown,
  SentimentTrendChart,
  ThemeBars,
} from "../../components/DashboardCharts";
import { getOverviewData } from "../../lib/data";

export const dynamic = "force-dynamic";

function fmtPct(
  value: number | null | undefined,
  digits = 1
) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return `${value.toFixed(digits)}%`;
}

function sentimentBadge(sentiment: string) {
  const safe = [
    "positive",
    "neutral",
    "negative",
  ].includes(sentiment)
    ? sentiment
    : "unknown";

  return (
    <span className={`sentiment-badge ${safe}`}>
      {sentiment}
    </span>
  );
}

function scoreTone(score: number) {
  return score >= 40
    ? "good"
    : score >= 0
      ? "mid"
      : "bad";
}

function Stars({
  rating,
}: {
  rating: number | null | undefined;
}) {
  if (rating == null) {
    return <span className="muted">—</span>;
  }

  return (
    <span
      className="stars"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= rating ? "" : "off"}
        >
          <Icon name="star" size={13} />
        </span>
      ))}
    </span>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<
    Record<
      string,
      string | string[] | undefined
    >
  >;
}) {
  const params = (await searchParams) ?? {};

  const filters = Object.fromEntries(
    Object.entries(params).map(
      ([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]
    )
  );

  const data = await getOverviewData(filters);

  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(
    filters
  )) {
    if (value) {
      qs.set(key, String(value));
    }
  }

  const query = qs.toString();

  const executiveHref = query
    ? `/executive?${query}`
    : "/executive";

  const exportHref = query
    ? `/api/export/reviews?${query}`
    : "/api/export/reviews";

  const isLocalBaseline =
    data.selectedModel === "VADER" ||
    data.selectedModel === "TextBlob";

  const isMeasuredModel =
    data.selectedModelSource === "measured";

  return (
    <>
      <div className="breadcrumbs">
        <span>Workspace</span>

        <span aria-hidden="true">/</span>

        <strong>Overview</strong>
      </div>

      <section className="page-header">
        <div>
          <div className="page-kicker">
            Customer intelligence
          </div>

          <h1>Overview</h1>

          <p>
            Product health, customer sentiment,
            emerging issues and AI quality in one
            place.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="secondary-button"
            href={executiveHref}
          >
            <Icon
              name="executive"
              size={16}
            />
            Executive view
          </Link>

          <ExportReportButton />
        </div>
      </section>

      <FilterBar
        products={data.products}
        sources={data.sources}
        models={data.models}
      />

      {!isLocalBaseline && (
        <div
          className="model-provenance-banner"
          role="note"
        >
          <div>
            <span className="banner-icon">
              <Icon
                name="alert"
                size={18}
              />
            </span>

            <span>
              <strong>
                Live API unavailable for this
                selected LLM/NLP on the demo
                platform.
              </strong>{" "}
              {isMeasuredModel
                ? "Results shown are real, fixed outputs from a previously completed and saved model run; they are not generated live in this session."
                : "Results shown are fixed, preloaded outputs from a stored model-output dataset; they are not generated live in this session."}
            </span>
          </div>

          <span>
            {data.selectedModelCoverage.toLocaleString()}{" "}
            review outputs
          </span>
        </div>
      )}

      <section
        className="kpi-grid"
        aria-label="Key metrics"
      >
        <article className="kpi-card">
          <div className="kpi-topline">
            <span className="kpi-label">
              Total reviews
            </span>

            <span className="kpi-icon accent">
              <Icon
                name="reviews"
                size={15}
              />
            </span>
          </div>

          <div className="kpi-value">
            {data.reviewCount.toLocaleString()}
          </div>

          <div className="kpi-foot">
            of{" "}
            {data.totalReviewCount.toLocaleString()}{" "}
            stored
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-topline">
            <span className="kpi-label">
              Average rating
            </span>

            <span className="kpi-icon">
              <Icon
                name="star"
                size={15}
              />
            </span>
          </div>

          <div className="kpi-value">
            {data.averageRating == null
              ? "—"
              : data.averageRating.toFixed(2)}

            <span className="kpi-unit">
              /5
            </span>
          </div>

          <div className="kpi-foot">
            Across filtered reviews
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-topline">
            <span className="kpi-label">
              Sentiment score
            </span>

            <span
              className="info-dot"
              title="Positive share minus negative share, from −100 to +100"
            >
              i
            </span>
          </div>

          <div className="kpi-value">
            {data.sentimentScore > 0
              ? "+"
              : ""}
            {data.sentimentScore.toFixed(1)}
          </div>

          <div className="kpi-foot">
            via {data.selectedModel}
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-topline">
            <span className="kpi-label">
              Positive
            </span>

            <span className="kpi-icon positive">
              <Icon
                name="smile"
                size={15}
              />
            </span>
          </div>

          <div className="kpi-value">
            {fmtPct(data.positivePct)}
          </div>

          <div className="kpi-foot">
            <span className="positive-text">
              {data.sentiments.positive.toLocaleString()}
            </span>{" "}
            reviews
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-topline">
            <span className="kpi-label">
              Negative
            </span>

            <span className="kpi-icon negative">
              <Icon
                name="frown"
                size={15}
              />
            </span>
          </div>

          <div className="kpi-value">
            {fmtPct(data.negativePct)}
          </div>

          <div className="kpi-foot">
            <span className="negative-text">
              {data.sentiments.negative.toLocaleString()}
            </span>{" "}
            reviews
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-topline">
            <span className="kpi-label">
              Review volume
            </span>

            <span className="kpi-icon">
              <Icon
                name="trend"
                size={15}
              />
            </span>
          </div>

          <div className="kpi-value">
            {data.periodChange == null
              ? "—"
              : `${
                  data.periodChange >= 0
                    ? "+"
                    : "−"
                }${fmtPct(
                  Math.abs(
                    data.periodChange
                  )
                )}`}
          </div>

          <div className="kpi-foot">
            {data.periodChange == null ? (
              "Not enough prior-period data"
            ) : (
              <>
                <span
                  className={`delta ${
                    data.periodChange >= 0
                      ? "up"
                      : "down"
                  }`}
                >
                  {data.periodChange >= 0
                    ? "↑"
                    : "↓"}
                </span>{" "}
                vs prior period
              </>
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-grid main-chart-grid">
        <article className="panel span-2">
          <div className="panel-header">
            <div>
              <h2>
                Sentiment over time
              </h2>

              <p>
                Monthly review sentiment ·{" "}
                {data.selectedModel}. Hover
                for detail, click a legend
                item to hide it.
              </p>
            </div>

            <a
              className="text-button"
              href={exportHref}
            >
              <Icon
                name="download"
                size={15}
              />
              CSV
            </a>
          </div>

          <SentimentTrendChart
            points={data.trendPoints}
          />
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Sentiment mix</h2>

              <p>
                Share of reviews by
                sentiment.
              </p>
            </div>
          </div>

          <SentimentBreakdown
            positive={
              data.sentiments.positive
            }
            neutral={
              data.sentiments.neutral
            }
            negative={
              data.sentiments.negative
            }
          />
        </article>
      </section>

      <section className="dashboard-grid secondary-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>
                Rating distribution
              </h2>

              <p>
                How customers score
                products, 1–5.
              </p>
            </div>
          </div>

          <RatingDistribution
            counts={
              data.ratingDistribution
            }
          />
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Top themes</h2>

              <p>
                Most-mentioned topics,
                coloured by dominant
                sentiment.
              </p>
            </div>

            <Link
              className="text-button"
              href="/insights"
            >
              All
              <Icon
                name="arrow-right"
                size={14}
              />
            </Link>
          </div>

          <ThemeBars
            themes={data.themeStats.slice(
              0,
              6
            )}
          />
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Key insights</h2>

              <p>
                Plain-language takeaways.
              </p>
            </div>
          </div>

          <div className="insight-list">
            {data.insights.length ? (
              data.insights
                .slice(0, 4)
                .map(
                  (
                    insight,
                    index
                  ) => (
                    <div
                      className="insight-item"
                      key={`${index}-${insight}`}
                    >
                      <div className="insight-number">
                        {index + 1}
                      </div>

                      <p>{insight}</p>
                    </div>
                  )
                )
            ) : (
              <div className="empty-state">
                No insights for these
                filters yet.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h2>
              Product comparison
            </h2>

            <p>
              Rating, volume and
              sentiment for each product.
            </p>
          </div>

          <Link
            className="text-button"
            href="/products"
          >
            View products
            <Icon
              name="arrow-right"
              size={14}
            />
          </Link>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>

                <th className="num">
                  Reviews
                </th>

                <th className="num">
                  Avg. rating
                </th>

                <th className="num">
                  Sentiment
                </th>

                <th>
                  Positive share
                </th>
              </tr>
            </thead>

            <tbody>
              {data.productStats.map(
                (product) => (
                  <tr key={product.name}>
                    <td>
                      <Link
                        className="product-cell"
                        href={`/products/${encodeURIComponent(
                          product.name
                        )}`}
                      >
                        <span className="product-dot">
                          {product.name
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>

                        <strong>
                          {product.name}
                        </strong>
                      </Link>
                    </td>

                    <td className="mono num">
                      {product.reviewCount.toLocaleString()}
                    </td>

                    <td className="mono num">
                      {product.averageRating ==
                      null
                        ? "—"
                        : product.averageRating.toFixed(
                            2
                          )}
                    </td>

                    <td className="num">
                      <span
                        className={`score-pill ${scoreTone(
                          product.sentimentScore
                        )}`}
                      >
                        {product.sentimentScore >
                        0
                          ? "+"
                          : ""}
                        {product.sentimentScore.toFixed(
                          1
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="inline-meter">
                        <div
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                product.positivePct
                              )
                            )}%`,
                          }}
                        />
                      </div>

                      <span className="mono">
                        {product.positivePct.toFixed(
                          1
                        )}
                        %
                      </span>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h2>Recent reviews</h2>

            <p>
              Latest feedback in this
              view.
            </p>
          </div>

          <Link
            className="text-button"
            href="/reviews"
          >
            View all
            <Icon
              name="arrow-right"
              size={14}
            />
          </Link>
        </div>

        <div className="table-wrap">
          {data.recentReviews.length ? (
            <table>
              <thead>
                <tr>
                  <th>Review</th>
                  <th>Product</th>
                  <th>Rating</th>
                  <th>Sentiment</th>
                  <th>Source</th>
                </tr>
              </thead>

              <tbody>
                {data.recentReviews.map(
                  (review) => {
                    const text =
                      String(
                        review.text ?? ""
                      );

                    return (
                      <tr key={review.id}>
                        <td
                          className="review-cell"
                          title={
                            text.length >
                            140
                              ? text
                              : undefined
                          }
                        >
                          {text.slice(
                            0,
                            140
                          )}

                          {text.length >
                          140
                            ? "…"
                            : ""}
                        </td>

                        <td>
                          {review.product}
                        </td>

                        <td>
                          <Stars
                            rating={
                              review.rating
                            }
                          />
                        </td>

                        <td>
                          {sentimentBadge(
                            review.sentiment
                          )}
                        </td>

                        <td className="muted">
                          {review.source ??
                            "—"}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          ) : (
            <div className="eval-empty">
              No reviews match these
              filters.
            </div>
          )}
        </div>
      </section>
    </>
  );
}