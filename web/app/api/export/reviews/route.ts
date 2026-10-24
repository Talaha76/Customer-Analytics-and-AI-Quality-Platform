import { createAdminClient } from "../../../../lib/supabase-admin";

function csv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const supabase = createAdminClient();
  const result = await supabase.from("feedback").select(`
    id,text,rating,source,created_at,
    datasets(products(name)),
    analyses(model_name,sentiment,sentiment_confidence)
  `).order("created_at", { ascending: false }).limit(5000);
  if (result.error) return new Response(result.error.message, { status: 500 });

  const lines = [["id","product","review","rating","source","date","model","sentiment","confidence"].join(",")];
  for (const row of result.data ?? []) {
    const dataset: any = Array.isArray((row as any).datasets) ? (row as any).datasets[0] : (row as any).datasets;
    const product: any = Array.isArray(dataset?.products) ? dataset.products[0] : dataset?.products;
    const analyses: any[] = Array.isArray((row as any).analyses) ? (row as any).analyses : [];
    if (!analyses.length) analyses.push({ model_name: "", sentiment: "", sentiment_confidence: "" });
    for (const analysis of analyses) {
      lines.push([
        csv((row as any).id), csv(product?.name), csv((row as any).text), csv((row as any).rating), csv((row as any).source),
        csv((row as any).created_at), csv(analysis.model_name), csv(analysis.sentiment), csv(analysis.sentiment_confidence)
      ].join(","));
    }
  }
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=safevision-reviews.csv" },
  });
}
