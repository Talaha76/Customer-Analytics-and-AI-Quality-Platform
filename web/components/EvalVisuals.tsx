type Run = {
  id: string; model_name: string; accuracy: number | null; f1_macro: number | null;
  avg_latency_ms: number | null; result_source: string | null;
};

export function EvalSummaryBars({ runs }: { runs: Run[] }) {
  return (
    <div className="eval-bars">
      {runs.map((run) => {
        const accuracy = Number(run.accuracy ?? 0) * 100;
        const f1 = Number(run.f1_macro ?? 0) * 100;
        const estimated = (run.result_source ?? "measured") !== "measured";
        return (
          <div className={`eval-bar-row ${estimated ? "estimated-row" : ""}`} key={run.id}>
            <div className="eval-model-label"><strong>{run.model_name}</strong><span>{estimated ? "Estimated" : "Measured"}</span></div>
            <div className="eval-metric-bars">
              <div><span>Accuracy</span><div className="metric-track"><div className="metric-fill accuracy" style={{ width: `${accuracy}%` }} /></div><b>{accuracy.toFixed(1)}%</b></div>
              <div><span>Macro F1</span><div className="metric-track"><div className="metric-fill f1" style={{ width: `${f1}%` }} /></div><b>{f1.toFixed(1)}%</b></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LatencyBars({ runs }: { runs: Run[] }) {
  const max = Math.max(1, ...runs.map((run) => Number(run.avg_latency_ms ?? 0)));
  return (
    <div className="latency-bars">
      {runs.map((run) => {
        const value = Number(run.avg_latency_ms ?? 0);
        return <div className="latency-row" key={run.id}><span>{run.model_name}</span><div className="latency-track"><div style={{ width: `${Math.max(2, value / max * 100)}%` }} /></div><strong>{value.toFixed(value < 1 ? 3 : 1)} ms</strong></div>;
      })}
    </div>
  );
}

export function ConfusionMatrix({ title, matrix }: { title: string; matrix: Record<string, Record<string, number>> }) {
  const labels = ["positive", "neutral", "negative"];
  return (
    <div className="confusion-card">
      <h3>{title}</h3><p>Rows are expected labels; columns are model predictions.</p>
      <table className="confusion-table"><thead><tr><th>Expected ↓</th>{labels.map((label) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{labels.map((expected) => <tr key={expected}><th>{expected}</th>{labels.map((predicted) => <td key={predicted}>{matrix?.[expected]?.[predicted] ?? 0}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function RegressionSparkline({ points }: { points: { label: string; value: number }[] }) {
  if (points.length < 2) return <span className="muted">Run again to create regression history.</span>;
  const width = 220, height = 56, pad = 6;
  const min = Math.min(...points.map((p) => p.value), .2);
  const max = Math.max(...points.map((p) => p.value), .8);
  const x = (i: number) => pad + i / Math.max(1, points.length - 1) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - min) / Math.max(.001, max - min)) * (height - pad * 2);
  const coords = points.map((point, i) => `${x(i)},${y(point.value)}`).join(" ");
  return <svg className="regression-spark" viewBox={`0 0 ${width} ${height}`}><polyline points={coords} /><circle cx={x(points.length - 1)} cy={y(points[points.length - 1].value)} r="3" /></svg>;
}
