import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.feedbackId) return NextResponse.json({ error: "feedbackId is required" }, { status: 400 });
    if (!["positive", "neutral", "negative"].includes(body.correctedSentiment)) {
      return NextResponse.json({ error: "Choose a valid corrected sentiment" }, { status: 400 });
    }
    const supabase = createAdminClient();
    const result = await supabase.from("human_labels").insert({
      feedback_id: body.feedbackId,
      analysis_id: body.analysisId ?? null,
      reviewer_label: body.reviewerLabel ?? "reviewer",
      corrected_sentiment: body.correctedSentiment,
      corrected_topics: body.correctedTopics ?? [],
      corrected_severity: body.correctedSeverity ?? null,
      corrected_pain_points: body.correctedPainPoints ?? [],
      corrected_feature_requests: body.correctedFeatureRequests ?? [],
      corrected_recommendation: body.correctedRecommendation ?? null,
      notes: body.notes ?? null,
      review_status: body.reviewStatus ?? "reviewed",
      updated_at: new Date().toISOString(),
    }).select("id").single();
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, id: result.data.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save label" }, { status: 500 });
  }
}
