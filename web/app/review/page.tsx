import HumanReviewClient from "../../components/HumanReviewClient";
import { getHumanReviewQueue } from "../../lib/data";

export const dynamic = "force-dynamic";

export default async function HumanReviewPage() {
  const rows = await getHumanReviewQueue();
  return <>
    <div className="breadcrumbs"><span>AI & Intelligence</span><span>/</span><strong>Human Review</strong></div>
    <section className="page-header"><div><h1>Human Review</h1><p>Approve model output or correct sentiment, topics, pain points, feature requests, severity, and recommendations. Every decision is saved to <span className="mono">human_labels</span>.</p></div></section>
    <HumanReviewClient initialRows={rows as any} />
  </>;
}
