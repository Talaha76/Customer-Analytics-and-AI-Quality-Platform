"use client";

import { useMemo, useState } from "react";

type Product = {
  name: string;
  reviewCount: number;
  averageRating: number | null;
  sentimentScore: number;
  positivePct: number;
};

export default function ProductCompare({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [show, setShow] = useState(false);

  const chosen = useMemo(
    () => products.filter((product) => selected.includes(product.name)),
    [products, selected]
  );

  function toggle(name: string) {
    setShow(false);
    setSelected((current) => {
      if (current.includes(name)) return current.filter((item) => item !== name);
      if (current.length >= 4) return current;
      return [...current, name];
    });
  }

  return (
    <section className="panel product-compare-panel">
      <div className="panel-header">
        <div>
          <h2>Compare products</h2>
          <p>Select 2 to 4 products for a side-by-side business comparison.</p>
        </div>
        <button
          className="primary-button"
          disabled={selected.length < 2}
          type="button"
          onClick={() => setShow(true)}
        >
          Compare selected ({selected.length})
        </button>
      </div>

      <div className="compare-picker">
        {products.map((product) => (
          <label className={`compare-choice ${selected.includes(product.name) ? "selected" : ""}`} key={product.name}>
            <input
              type="checkbox"
              checked={selected.includes(product.name)}
              onChange={() => toggle(product.name)}
            />
            <span>{product.name}</span>
          </label>
        ))}
      </div>

      {show && chosen.length >= 2 && (
        <div className="compare-grid">
          {chosen.map((product) => (
            <article className="compare-card" key={product.name}>
              <h3>{product.name}</h3>
              <div><span>Reviews</span><strong>{product.reviewCount.toLocaleString()}</strong></div>
              <div><span>Average rating</span><strong>{product.averageRating?.toFixed(2) ?? "—"}</strong></div>
              <div><span>Sentiment score</span><strong>{product.sentimentScore.toFixed(1)}</strong></div>
              <div><span>Positive share</span><strong>{product.positivePct.toFixed(1)}%</strong></div>
              <div className="wide-meter"><div style={{ width: `${Math.max(0, Math.min(100, product.positivePct))}%` }} /></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
