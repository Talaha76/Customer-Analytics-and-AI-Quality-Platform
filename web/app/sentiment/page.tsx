import {
  RatingDistribution,
  SentimentBreakdown,
  SentimentTrendChart,
} from "../../components/DashboardCharts";
import { getOverviewData } from "../../lib/data";

export const dynamic = "force-dynamic";

export default async function SentimentPage() {
  const data = await getOverviewData({ days: "all" });

  return (
    <>
      <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>Sentiment</strong></div>
      <section className="page-header">
        <div>
          <h1>Sentiment Analysis</h1>
          <p>Track how customer sentiment changes over time and across products.</p>
        </div>
      </section>

      <section className="dashboard-grid main-chart-grid">
        <article className="panel span-2">
          <div className="panel-header"><div><h2>Sentiment trend</h2><p>Historical classification using {data.selectedModel}.</p></div></div>
          <SentimentTrendChart points={data.trendPoints} />
        </article>
        <article className="panel">
          <div className="panel-header"><div><h2>Overall breakdown</h2><p>Distribution across all stored reviews.</p></div></div>
          <SentimentBreakdown {...data.sentiments} />
        </article>
      </section>

      <section className="dashboard-grid two-panel-grid">
        <article className="panel">
          <div className="panel-header"><div><h2>Rating distribution</h2><p>Review scores across the portfolio.</p></div></div>
          <RatingDistribution counts={data.ratingDistribution} />
        </article>
        <article className="panel">
          <div className="panel-header"><div><h2>How to read sentiment score</h2><p>A business-friendly interpretation.</p></div></div>
          <div className="definition-list">
            <div><strong>Positive</strong><span>Customers are expressing satisfaction, approval, or advocacy.</span></div>
            <div><strong>Neutral</strong><span>Feedback is mixed, factual, or lacks a strong emotional direction.</span></div>
            <div><strong>Negative</strong><span>Customers are expressing dissatisfaction, friction, or unmet expectations.</span></div>
            <div><strong>Score</strong><span>Positive share minus negative share, normalized from −100 to +100.</span></div>
          </div>
        </article>
      </section>
    </>
  );
}
