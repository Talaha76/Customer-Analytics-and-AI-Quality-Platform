import Link from "next/link";
import ExportReportButton from "../../components/ExportReportButton";
import { SentimentBreakdown, SentimentTrendChart, ThemeBars } from "../../components/DashboardCharts";
import { getOverviewData } from "../../lib/data";

export const dynamic = "force-dynamic";

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

export default async function ExecutivePage({
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
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );
  const data = await getOverviewData(filters);

  return <>
    <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>Executive</strong></div>
    <section className="page-header executive-header">
      <div>
        <div className="page-kicker">Leadership summary</div>
        <h1>Executive view</h1>
        <p>A concise view of customer health, product performance, emerging themes, and model quality.</p>
      </div>
      <div className="page-actions">
        <Link className="secondary-button" href="/dashboard">Full workspace</Link>
        <ExportReportButton label="Print / PDF" />
      </div>
    </section>

    {data.selectedModelSource !== "measured" && <div className="model-provenance-banner compact">
      <div><strong>{data.selectedModel}</strong> is shown with estimated demo review-level sentiment outputs.</div>
      <span>Not a measured benchmark</span>
    </div>}

    <section className="executive-kpi-grid">
      <article className="executive-kpi"><span>Reviews</span><strong>{data.reviewCount.toLocaleString()}</strong><small>current view</small></article>
      <article className="executive-kpi"><span>Average rating</span><strong>{data.averageRating?.toFixed(2) ?? "—"}</strong><small>out of 5</small></article>
      <article className="executive-kpi"><span>Sentiment score</span><strong>{data.sentimentScore.toFixed(1)}</strong><small>{data.selectedModel}</small></article>
      <article className="executive-kpi"><span>Positive</span><strong className="positive-text">{pct(data.positivePct)}</strong><small>{data.sentiments.positive.toLocaleString()} reviews</small></article>
      <article className="executive-kpi"><span>Negative</span><strong className="negative-text">{pct(data.negativePct)}</strong><small>{data.sentiments.negative.toLocaleString()} reviews</small></article>
    </section>

    <section className="executive-insight-band">
      <div className="executive-insight-heading"><span>Key takeaways</span><h2>What leadership should know</h2></div>
      <div className="executive-insight-list">
        {data.insights.slice(0,4).map((insight, index)=><div key={insight}><span>{String(index+1).padStart(2,"0")}</span><p>{insight}</p></div>)}
      </div>
    </section>

    <section className="dashboard-grid main-chart-grid executive-charts">
      <article className="panel span-2"><div className="panel-header"><div><h2>Sentiment trajectory</h2><p>Customer sentiment over time using {data.selectedModel}.</p></div></div><SentimentTrendChart points={data.trendPoints}/></article>
      <article className="panel"><div className="panel-header"><div><h2>Sentiment mix</h2><p>Current customer sentiment distribution.</p></div></div><SentimentBreakdown {...data.sentiments}/></article>
    </section>

    <section className="dashboard-grid two-panel-grid">
      <article className="panel"><div className="panel-header"><div><h2>Top themes</h2><p>Highest-volume persisted customer themes.</p></div></div><ThemeBars themes={data.themeStats}/></article>
      <article className="panel table-panel executive-product-table"><div className="panel-header"><div><h2>Product health</h2><p>Portfolio comparison ranked by customer rating.</p></div></div><div className="table-wrap"><table><thead><tr><th>Product</th><th>Reviews</th><th>Rating</th><th>Positive</th></tr></thead><tbody>{data.productStats.map((product)=><tr key={product.name}><td><strong>{product.name}</strong></td><td className="mono">{product.reviewCount}</td><td className="mono">{product.averageRating?.toFixed(2) ?? "—"}</td><td className="mono">{product.positivePct.toFixed(1)}%</td></tr>)}</tbody></table></div></article>
    </section>

    <section className="executive-quality-strip">
      <div><span>Evaluation coverage</span><strong>{data.evalCaseCount} cases</strong></div>
      <div><span>Best measured baseline</span><strong>{data.bestMeasuredRun?.model_name ?? "—"}</strong></div>
      <div><span>Best measured macro F1</span><strong>{data.bestMeasuredRun?.f1_macro != null ? `${(Number(data.bestMeasuredRun.f1_macro)*100).toFixed(1)}%` : "—"}</strong></div>
      <Link href="/evals">Open model evaluation →</Link>
    </section>
  </>;
}
