import Link from "next/link";
import { RatingDistribution, SentimentBreakdown, SentimentTrendChart } from "../../../components/DashboardCharts";
import { getProductDetail } from "../../../lib/data";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const resolved = await params;
  const name = decodeURIComponent(resolved.product);
  const data = await getProductDetail(name);
  const overview = data.overview;
  return <>
    <div className="breadcrumbs"><Link href="/products">Products</Link><span>/</span><strong>{name}</strong></div>
    <section className="page-header"><div><h1>{name}</h1><p>Product-specific customer health, sentiment, themes, emerging issues, and evidence.</p></div><Link className="secondary-button" href="/products">Back to products</Link></section>
    <section className="kpi-grid product-kpis">
      <article className="kpi-card"><span className="kpi-label">Reviews</span><div className="kpi-value">{overview.reviewCount}</div></article>
      <article className="kpi-card"><span className="kpi-label">Average rating</span><div className="kpi-value">{overview.averageRating?.toFixed(2)??"—"}</div></article>
      <article className="kpi-card"><span className="kpi-label">Sentiment score</span><div className="kpi-value">{overview.sentimentScore.toFixed(1)}</div></article>
      <article className="kpi-card"><span className="kpi-label">Positive</span><div className="kpi-value">{overview.positivePct.toFixed(1)}%</div></article>
      <article className="kpi-card"><span className="kpi-label">Negative</span><div className="kpi-value">{overview.negativePct.toFixed(1)}%</div></article>
    </section>
    <section className="dashboard-grid main-chart-grid"><article className="panel span-2"><div className="panel-header"><div><h2>Sentiment trend</h2><p>Historical sentiment for {name}.</p></div></div><SentimentTrendChart points={overview.trendPoints}/></article><article className="panel"><div className="panel-header"><div><h2>Sentiment breakdown</h2></div></div><SentimentBreakdown {...overview.sentiments}/></article></section>
    <section className="dashboard-grid two-panel-grid"><article className="panel"><div className="panel-header"><div><h2>Rating distribution</h2></div></div><RatingDistribution counts={overview.ratingDistribution}/></article><article className="panel"><div className="panel-header"><div><h2>Product intelligence</h2><p>Persisted TF-IDF/rule-based insights with linked evidence.</p></div></div><div className="compact-insights">{data.insights.slice(0,6).map((item:any)=><div key={item.id}><span className={`insight-type ${item.insight_type}`}>{item.insight_type.replaceAll("_"," ")}</span><strong>{item.title}</strong><p>{item.description}</p></div>)}</div></article></section>
    <section className="panel table-panel"><div className="panel-header"><div><h2>Recent reviews</h2><p>Evidence behind this product view.</p></div></div><div className="table-wrap"><table><thead><tr><th>Review</th><th>Rating</th><th>Source</th><th>Date</th></tr></thead><tbody>{data.reviews.map((r:any)=><tr key={r.id}><td className="review-cell wide">{r.text}</td><td>{r.rating??"—"}</td><td>{r.source??"—"}</td><td>{r.created_at?new Date(r.created_at).toLocaleDateString():"—"}</td></tr>)}</tbody></table></div></section>
  </>;
}
