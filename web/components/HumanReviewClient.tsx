"use client";

import { useEffect, useMemo, useState } from "react";

type Analysis = {
  id: string;
  model_name: string;
  sentiment: string | null;
  topics: unknown;
  pain_points: unknown;
  feature_requests: unknown;
  severity: string | null;
  recommendation: string | null;
};

type ReviewRow = {
  id: string;
  text: string;
  rating: number | null;
  source: string | null;
  product: string;
  analyses: Analysis[];
  reviewed: boolean;
  latestLabel?: any;
};

function listText(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : "";
}
function parseList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function HumanReviewClient({ initialRows }: { initialRows: ReviewRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [index, setIndex] = useState(0);
  const current = rows[index];
  const [modelName, setModelName] = useState(current?.analyses?.[0]?.model_name ?? "");
  const analysis = useMemo(
    () => current?.analyses?.find((item) => item.model_name === modelName) ?? current?.analyses?.[0],
    [current, modelName]
  );
  const [sentiment, setSentiment] = useState(analysis?.sentiment ?? "neutral");
  const [topics, setTopics] = useState(listText(analysis?.topics));
  const [severity, setSeverity] = useState(analysis?.severity ?? "");
  const [painPoints, setPainPoints] = useState(listText(analysis?.pain_points));
  const [featureRequests, setFeatureRequests] = useState(listText(analysis?.feature_requests));
  const [recommendation, setRecommendation] = useState(analysis?.recommendation ?? "");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setModelName(current?.analyses?.[0]?.model_name ?? "");
  }, [current?.id]);

  useEffect(() => {
    setSentiment(analysis?.sentiment ?? "neutral");
    setTopics(listText(analysis?.topics));
    setSeverity(analysis?.severity ?? "");
    setPainPoints(listText(analysis?.pain_points));
    setFeatureRequests(listText(analysis?.feature_requests));
    setRecommendation(analysis?.recommendation ?? "");
    setNotes("");
  }, [analysis?.id]);

  if (!current) {
    return <div className="panel empty-workflow"><h2>No reviews are available.</h2></div>;
  }

  async function save(reviewStatus: "approved" | "corrected") {
    setStatus("Saving…");
    const response = await fetch("/api/human-labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedbackId: current.id,
        analysisId: analysis?.id ?? null,
        reviewerLabel: "portfolio-reviewer",
        correctedSentiment: sentiment,
        correctedTopics: parseList(topics),
        correctedSeverity: severity || null,
        correctedPainPoints: parseList(painPoints),
        correctedFeatureRequests: parseList(featureRequests),
        correctedRecommendation: recommendation || null,
        notes,
        reviewStatus,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error ?? "Could not save label");
      return;
    }
    setRows((currentRows) => currentRows.map((row, i) => i === index ? { ...row, reviewed: true } : row));
    setStatus(reviewStatus === "approved" ? "Approved and saved" : "Correction saved");
    if (index < rows.length - 1) setTimeout(() => setIndex((value) => value + 1), 450);
  }

  const reviewedCount = rows.filter((row) => row.reviewed).length;

  return (
    <div className="human-review-layout">
      <aside className="review-queue panel">
        <div className="panel-header"><div><h2>Review queue</h2><p>{reviewedCount} of {rows.length} reviewed</p></div></div>
        <div className="review-progress"><div style={{ width: `${rows.length ? reviewedCount / rows.length * 100 : 0}%` }} /></div>
        <div className="queue-list">
          {rows.map((row, rowIndex) => (
            <button className={`queue-item ${rowIndex === index ? "active" : ""}`} key={row.id} onClick={() => setIndex(rowIndex)}>
              <div><strong>{row.product}</strong><span>{String(row.text).slice(0, 70)}{String(row.text).length > 70 ? "…" : ""}</span></div>
              <span className={row.reviewed ? "queue-status done" : "queue-status"}>{row.reviewed ? "Reviewed" : "Pending"}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="review-editor panel">
        <div className="review-context">
          <div><span>Product</span><strong>{current.product}</strong></div>
          <div><span>Rating</span><strong>{current.rating ?? "—"}</strong></div>
          <div><span>Source</span><strong>{current.source ?? "—"}</strong></div>
        </div>
        <blockquote className="review-quote">{current.text}</blockquote>

        <div className="review-model-row">
          <label>Model output
            <select value={modelName} onChange={(event) => setModelName(event.target.value)}>
              {current.analyses.map((item) => <option key={item.id} value={item.model_name}>{item.model_name}</option>)}
            </select>
          </label>
          <div className="model-prediction"><span>Prediction</span><strong>{analysis?.sentiment ?? "No analysis"}</strong></div>
        </div>

        <div className="review-form-grid">
          <label>Corrected sentiment
            <select value={sentiment} onChange={(event) => setSentiment(event.target.value)}>
              <option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option>
            </select>
          </label>
          <label>Severity<input value={severity} onChange={(event) => setSeverity(event.target.value)} placeholder="low / medium / high" /></label>
          <label className="full">Topics<input value={topics} onChange={(event) => setTopics(event.target.value)} placeholder="battery, camera, support" /></label>
          <label className="full">Pain points<input value={painPoints} onChange={(event) => setPainPoints(event.target.value)} placeholder="battery drains quickly, setup is confusing" /></label>
          <label className="full">Feature requests<input value={featureRequests} onChange={(event) => setFeatureRequests(event.target.value)} placeholder="longer battery life, dark mode" /></label>
          <label className="full">Recommendation<textarea value={recommendation} onChange={(event) => setRecommendation(event.target.value)} /></label>
          <label className="full">Reviewer notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Why did you approve or correct this output?" /></label>
        </div>

        <div className="review-actions">
          <span className="review-save-status">{status}</span>
          <button className="secondary-button" type="button" onClick={() => save("corrected")}>Save correction</button>
          <button className="primary-button" type="button" onClick={() => save("approved")}>Approve output</button>
        </div>
      </section>
    </div>
  );
}
