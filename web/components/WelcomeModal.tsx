"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./WelcomeModal.module.css";

const STORAGE_KEY = "senvu-welcome-seen";

export default function WelcomeModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) !== "1") {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  function rememberAndClose() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage may be unavailable in restrictive browser modes.
    }

    setOpen(false);
  }

  function openDemo() {
    rememberAndClose();
    router.push("/demo");
  }

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation">
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="senvu-welcome-title"
      >
        <button
          type="button"
          className={styles.close}
          aria-label="Close welcome message"
          onClick={rememberAndClose}
        >
          ×
        </button>

        <div className={styles.heroPanel}>
          <div className={styles.heroGlow} />
          <img className={styles.logo} src="/senvu-logo.png" alt="Senvu" />
          <div className={styles.kicker}>Customer Intelligence &amp; AI Evals</div>

          <h1 id="senvu-welcome-title">Turn customer feedback into clear product decisions.</h1>
          <p>
            Senvu helps teams understand what customers love, where they struggle, what they want next, and how reliably AI is interpreting their feedback.
          </p>

          <div className={styles.heroMetricRow}>
            <div><strong>1,200+</strong><span>portfolio reviews</span></div>
            <div><strong>100</strong><span>evaluation cases</span></div>
            <div><strong>75</strong><span>interactive demo reviews</span></div>
          </div>
        </div>

        <div className={styles.contentPanel}>
          <div className={styles.featureGrid}>
            <div>
              <span className={styles.featureIcon}>◉</span>
              <div><strong>Understand customers</strong><p>Sentiment, themes, pain points, and product demand.</p></div>
            </div>
            <div>
              <span className={styles.featureIcon}>↗</span>
              <div><strong>Spot what is changing</strong><p>Surface recurring and emerging customer issues.</p></div>
            </div>
            <div>
              <span className={styles.featureIcon}>✦</span>
              <div><strong>Turn evidence into action</strong><p>Connect reviews to recommendations and next steps.</p></div>
            </div>
            <div>
              <span className={styles.featureIcon}>✓</span>
              <div><strong>Evaluate AI quality</strong><p>Compare model behavior, failures, and human corrections.</p></div>
            </div>
          </div>

          <div className={styles.choicePanel}>
            <div>
              <span>Choose how to explore</span>
              <strong>Browse the full workspace or try the product yourself.</strong>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={rememberAndClose}>
                Explore dashboard
              </button>
              <button type="button" className={styles.primary} onClick={openDemo}>
                Try interactive demo →
              </button>
            </div>
          </div>

          <div className={styles.notice}>
            <span className={styles.noticeDot} />
            <div>
              <strong>Safe to explore.</strong>
              <p>The main workspace is read-only for visitors. Demo interactions are temporary and never write to the shared Supabase dataset.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
