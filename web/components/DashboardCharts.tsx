"use client";

import { useId, useMemo, useState } from "react";
import Icon from "./Icon";

type TrendPoint = {
  month: string;
  positive: number;
  neutral: number;
  negative: number;
};

type SeriesKey = "positive" | "neutral" | "negative";

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "positive", label: "Positive", color: "var(--positive)" },
  { key: "neutral", label: "Neutral", color: "var(--neutral)" },
  { key: "negative", label: "Negative", color: "var(--negative)" },
];

/** Smooth curve through points; control points are clamped so it never overshoots. */
function smoothPath(pts: [number, number][]) {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    const clamp = (v: number) => Math.max(lo, Math.min(hi, v));
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = clamp(p1[1] + (p2[1] - p0[1]) * t);
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = clamp(p2[1] - (p3[1] - p1[1]) * t);
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

export function SentimentTrendChart({ points }: { points: TrendPoint[] }) {
  const gid = useId().replace(/:/g, "");
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const [hover, setHover] = useState<number | null>(null);

  const width = 760;
  const height = 260;
  const padL = 40;
  const padR = 12;
  const padTop = 14;
  const padBottom = 30;
  const innerW = width - padL - padR;
  const innerH = height - padTop - padBottom;

  const visible = SERIES.filter((s) => !hidden.has(s.key));
  const maxY = useMemo(
    () => niceMax(Math.max(1, ...points.flatMap((p) => visible.map((s) => p[s.key])))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, hidden]
  );

  if (!points.length) {
    return (
      <div className="empty-chart">
        <Icon name="trend" size={22} />
        No sentiment trend data for these filters.
      </div>
    );
  }

  const x = (i: number) => padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padTop + innerH - (v / maxY) * innerH;
  const baseline = padTop + innerH;

  function toggle(key: SeriesKey) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < SERIES.length - 1) next.add(key); // keep at least one visible
      return next;
    });
  }

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * width;
    const i = points.length === 1 ? 0 : Math.round(((vx - padL) / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  const hoverPoint = hover != null ? points[hover] : null;
  const total = hoverPoint ? hoverPoint.positive + hoverPoint.neutral + hoverPoint.negative : 0;

  return (
    <div className="chart-wrap">
      <div className="chart-legend" style={{ marginBottom: 12 }}>
        {SERIES.map((s) => (
          <button
            type="button"
            key={s.key}
            className={`legend-item ${s.key}-line`}
            aria-pressed={!hidden.has(s.key)}
            onClick={() => toggle(s.key)}
          >
            <i /> {s.label}
          </button>
        ))}
      </div>

      <svg
        className="line-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Sentiment trend over time"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {SERIES.map((s) => (
            <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
          const gy = padTop + innerH * r;
          return (
            <g key={r}>
              <line x1={padL} x2={width - padR} y1={gy} y2={gy} className="grid-line" />
              <text x={padL - 10} y={gy + 4} textAnchor="end" className="chart-axis-text">
                {Math.round(maxY * (1 - r)).toLocaleString()}
              </text>
            </g>
          );
        })}

        {visible.map((s) => {
          const pts = points.map((p, i) => [x(i), y(p[s.key])] as [number, number]);
          const line = smoothPath(pts);
          const area = `${line} L${pts[pts.length - 1][0]},${baseline} L${pts[0][0]},${baseline} Z`;
          return (
            <g key={s.key}>
              <path d={area} className="trend-area" fill={`url(#${gid}-${s.key})`} />
              <path d={line} className={`trend-line ${s.key}-line`} />
            </g>
          );
        })}

        {points.map((p, i) => (
          <text key={`${p.month}-${i}`} x={x(i)} y={height - 8} textAnchor="middle" className="chart-axis-text">
            {p.month}
          </text>
        ))}

        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={baseline} className="chart-crosshair" />
            {visible.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(points[hover][s.key])} r={4.5} fill={s.color} className="chart-dot" />
            ))}
          </g>
        )}
      </svg>

      {hoverPoint && (
        <div
          className="chart-tooltip"
          style={{ left: `${(x(hover!) / width) * 100}%`, top: 44 }}
          role="status"
        >
          <strong>{hoverPoint.month}</strong>
          {visible.map((s) => (
            <div className="tt-row" key={s.key}>
              <i style={{ background: s.color }} />
              <span>{s.label}</span>
              <b>
                {hoverPoint[s.key].toLocaleString()}
                <span className="muted" style={{ fontWeight: 500 }}>
                  {" "}· {total ? Math.round((hoverPoint[s.key] / total) * 100) : 0}%
                </span>
              </b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RatingDistribution({ counts }: { counts: Record<number, number> }) {
  const values = [5, 4, 3, 2, 1].map((r) => counts[r] ?? 0);
  const max = Math.max(1, ...values);
  const total = Math.max(1, values.reduce((a, b) => a + b, 0));
  return (
    <div className="rating-bars">
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = counts[rating] ?? 0;
        return (
          <div className="rating-row" key={rating}>
            <div className="rating-label">
              {rating}
              <Icon name="star" size={13} />
            </div>
            <div className="rating-track" role="presentation">
              <div className="rating-fill" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <div className="rating-count">
              {count.toLocaleString()}
              <small>{Math.round((count / total) * 100)}%</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SentimentBreakdown({
  positive,
  neutral,
  negative,
}: {
  positive: number;
  neutral: number;
  negative: number;
}) {
  const sum = positive + neutral + negative;
  const total = Math.max(1, sum);
  const rows = [
    { label: "Positive", value: positive, key: "positive" as const },
    { label: "Neutral", value: neutral, key: "neutral" as const },
    { label: "Negative", value: negative, key: "negative" as const },
  ];

  const r = 42;
  const c = 2 * Math.PI * r;
  const gap = sum ? 1.5 : 0;
  let offset = 0;

  return (
    <div className="sentiment-breakdown">
      <div className="donut-wrap">
        <svg viewBox="0 0 100 100" aria-label="Sentiment breakdown" role="img">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--track)" strokeWidth={16} />
          {rows.map((row) => {
            const len = (row.value / total) * c;
            const seg = (
              <circle
                key={row.key}
                cx="50"
                cy="50"
                r={r}
                className="donut-seg"
                stroke={`var(--${row.key})`}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return seg;
          })}
        </svg>
        <div className="donut-center">
          <strong>{((positive / total) * 100).toFixed(0)}%</strong>
          <span>positive</span>
        </div>
      </div>

      <div className="sentiment-stats">
        {rows.map((row) => (
          <div className="sentiment-stat" key={row.key}>
            <div className={`sentiment-dot ${row.key}-bg`} />
            <div className="sentiment-stat-label">{row.label}</div>
            <div className="sentiment-stat-value">{((row.value / total) * 100).toFixed(1)}%</div>
            <div className="sentiment-stat-count">{row.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThemeBars({ themes }: { themes: { name: string; count: number; sentiment: string }[] }) {
  if (!themes.length) {
    return <div className="empty-chart">No theme signals found for these filters.</div>;
  }
  const max = Math.max(1, ...themes.map((t) => t.count));
  return (
    <div className="theme-bars">
      {themes.map((theme, index) => (
        <div className="theme-row" key={`${theme.name}-${theme.sentiment}-${index}`}>
          <div className="theme-name" title={`${theme.name} · ${theme.sentiment}`}>
            <i className={theme.sentiment} />
            <span>{theme.name}</span>
          </div>
          <div className="theme-track">
            <div className={`theme-fill ${theme.sentiment}`} style={{ width: `${(theme.count / max) * 100}%` }} />
          </div>
          <div className="theme-value">{theme.count.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
