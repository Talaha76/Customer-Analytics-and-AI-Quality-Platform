import Link from "next/link";
import ProductCompare from "../../components/ProductCompare";
import { getOverviewData } from "../../lib/data";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const data = await getOverviewData({ days: "all" });
  return <>
    <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>Products</strong></div>
    <section className="page-header"><div><h1>Products</h1><p>Compare customer response across your product portfolio and drill into individual product health.</p></div></section>
    <div className="product-grid">
      {data.productStats.map((product)=><Link className="product-card clickable" href={`/products/${encodeURIComponent(product.name)}`} key={product.name}>
        <div className="product-card-top"><div className="product-avatar">{product.name.slice(0,2).toUpperCase()}</div><div><h2>{product.name}</h2><p>Open product intelligence →</p></div></div>
        <div className="product-metrics"><div><span>Reviews</span><strong className="mono">{product.reviewCount}</strong></div><div><span>Avg. rating</span><strong className="mono">{product.averageRating?.toFixed(2)??"—"}</strong></div><div><span>Sentiment</span><strong className="mono">{product.sentimentScore.toFixed(1)}</strong></div></div>
        <div className="product-positive"><div><span>Positive share</span><strong>{product.positivePct.toFixed(1)}%</strong></div><div className="wide-meter"><div style={{width:`${Math.max(0,Math.min(100,product.positivePct))}%`}}/></div></div>
      </Link>)}
    </div>
    <ProductCompare products={data.productStats} />
  </>;
}
