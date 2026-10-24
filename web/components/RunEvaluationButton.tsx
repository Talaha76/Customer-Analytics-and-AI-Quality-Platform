"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RunEvaluationButton() {
  const router = useRouter();
  const [approach, setApproach] = useState("vader");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setRunning(true);
    setMessage("Running evaluation…");
    try {
      const response = await fetch("/api/evals/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approach }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Evaluation failed");
      setMessage(`${data.model_name ?? approach} completed · F1 ${data.f1_macro ?? "—"}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evaluation failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="run-eval-control">
      <select value={approach} onChange={(event) => setApproach(event.target.value)} aria-label="Evaluation model">
        <option value="vader">VADER · free/local</option>
        <option value="textblob">TextBlob · free/local</option>
        <option value="roberta">RoBERTa · local model</option>
        <option value="distilbert">DistilBERT · local model</option>
        <option value="openai">OpenAI Structured · API key required</option>
      </select>
      <button className="primary-button" type="button" disabled={running} onClick={run}>
        {running ? "Running…" : "Run evaluation"}
      </button>
      {message && <span className="run-message">{message}</span>}
    </div>
  );
}
