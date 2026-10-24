import { getReviewsData } from "../../lib/data";

export const dynamic = "force-dynamic";

function relationSentiment(analyses: any[]) {
  const vader = analyses?.find((a) => a.model_name === "VADER");
  return vader?.sentiment ?? analyses?.[0]?.sentiment ?? "unknown";
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<
    Record<string, string | string[] | undefined>
  >;
}) {
  const params = (await searchParams) ?? {};
  const rawQ = params.q;
  const q = Array.isArray(rawQ) ? rawQ[0] : rawQ ?? "";
  const rows = await getReviewsData(q);

  return (
    <>
      <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>Reviews</strong></div>
      <section className="page-header">
        <div>
          <h1>Customer Reviews</h1>
          <p>Search, compare, and inspect customer feedback with model-level sentiment context.</p>
        </div>
        <button className="secondary-button" type="button">Export CSV</button>
      </section>

      <form className="page-search" action="/reviews" method="get">
        <span aria-hidden="true">⌕</span>
        <input name="q" defaultValue={q} placeholder="Search review text…" />
        <button className="primary-button" type="submit">Search</button>
      </form>

      <section className="panel table-panel">
        <div className="panel-header compact">
          <div><h2>Review explorer</h2><p>{rows.length} rows shown</p></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Review</th><th>Product</th><th>Rating</th><th>Sentiment</th><th>Source</th><th>Date</th></tr></thead>
            <tbody>
              {rows.map((row: any) => {
                const sentiment = relationSentiment(row.analyses);
                return (
                  <tr key={row.id}>
                    <td className="review-cell wide">{row.text}</td>
                    <td>{row.product}</td>
                    <td className="mono">{row.rating ?? "—"}</td>
                    <td><span className={`sentiment-badge ${sentiment}`}>{sentiment}</span></td>
                    <td>{row.source ?? "—"}</td>
                    <td className="muted">{row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
