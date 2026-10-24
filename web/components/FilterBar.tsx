"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import Icon from "./Icon";

type Props = {
  products: string[];
  sources: string[];
  models: string[];
};

const DEMO_MODELS = new Set(["RoBERTa", "DistilBERT", "OpenAI Structured"]);
const RANGES = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "all", label: "All" },
];
const DEFAULT_DAYS = "30";
const DEFAULT_MODEL = "VADER";

const CHIP_LABEL: Record<string, (v: string) => string> = {
  days: (v) => (v === "all" ? "All time" : `Last ${v} days`),
  rating: (v) => `${v} stars`,
  sentiment: (v) => v.charAt(0).toUpperCase() + v.slice(1),
};

export default function FilterBar({ products, sources, models }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    const isDefault =
      !value ||
      (key === "days" ? value === DEFAULT_DAYS : key === "model" ? value === DEFAULT_MODEL : value === "all");
    if (isDefault) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  const get = (k: string) => searchParams.get(k);
  const days = get("days") ?? DEFAULT_DAYS;

  const active = (["product", "days", "sentiment", "rating", "source", "model"] as const)
    .map((key) => [key, get(key)] as const)
    .filter(([key, v]) => v && !(key === "days" && v === DEFAULT_DAYS) && !(key === "model" && v === DEFAULT_MODEL) && v !== "all");

  const select = (
    key: string,
    label: string,
    labelWidth: number,
    options: { value: string; label: string }[],
    fallback = "all"
  ) => {
    const value = get(key) ?? fallback;
    return (
      <label className={`filter-field${value !== fallback ? " is-set" : ""}`} style={{ ["--label-w" as string]: `${labelWidth}px` }}>
        <span>{label}</span>
        <select value={value} onChange={(e) => update(key, e.target.value)} aria-label={label}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    );
  };

  return (
    <section className={`filter-bar${pending ? " pending" : ""}`} aria-label="Dashboard filters" aria-busy={pending}>
      <div className="filter-row">
        <div className="filter-title"><Icon name="filter" size={16} /> Filters</div>

        <div className="segmented" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r.value} type="button" aria-pressed={days === r.value} onClick={() => update("days", r.value)}>
              {r.label}
            </button>
          ))}
        </div>

        <span className="filter-divider" aria-hidden="true" />

        {select("product", "Product", 52, [{ value: "all", label: "All" }, ...products.map((p) => ({ value: p, label: p }))])}
        {select("sentiment", "Sentiment", 66, [
          { value: "all", label: "All" },
          { value: "positive", label: "Positive" },
          { value: "neutral", label: "Neutral" },
          { value: "negative", label: "Negative" },
        ])}
        {select("rating", "Rating", 42, [{ value: "all", label: "All" }, ...[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r} ★` }))])}
        {select("source", "Source", 46, [{ value: "all", label: "All" }, ...sources.map((s) => ({ value: s, label: s }))])}

        <span className="filter-spacer" />

        {select(
          "model",
          "Model",
          42,
          models.map((m) => ({ value: m, label: `${m}${DEMO_MODELS.has(m) ? " (demo)" : ""}` })),
          DEFAULT_MODEL
        )}
      </div>

      {active.length > 0 && (
        <div className="active-filter-row">
          <span className="active-filter-label">Showing</span>
          {active.map(([key, value]) => (
            <button
              className="filter-chip"
              key={key}
              type="button"
              onClick={() => update(key, "")}
              aria-label={`Remove ${key} filter`}
            >
              {CHIP_LABEL[key]?.(value!) ?? value}
              <span className="chip-x" aria-hidden="true">×</span>
            </button>
          ))}
          <button className="clear-button" type="button" onClick={() => startTransition(() => router.push(pathname, { scroll: false }))}>
            Reset all
          </button>
        </div>
      )}
    </section>
  );
}
