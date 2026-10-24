"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import styles from "./DemoSandbox.module.css";

type Sentiment = "positive" | "neutral" | "negative";
type ModelChoice = "VADER" | "TextBlob";
type ReviewFilter = "all" | Sentiment;

type DemoReview = {
  id: string;
  text: string;
  rating: number | null;
  source: string;
  dateLabel: string;
  sentiment?: Sentiment;
  confidence?: number;
};

type DemoProduct = {
  name: string;
  category: string;
};

type ThemeSignal = {
  label: string;
  count: number;
  negativeCount: number;
  negativeShare: number;
  evidence: DemoReview[];
  insight: string;
  action: string;
  priority: "High" | "Medium" | "Opportunity";
};

const REVIEW_BLUEPRINTS = [
  { text: "Bluetooth disconnects whenever I switch between my laptop and phone.", rating: 2 },
  { text: "The sound is excellent and voices are much clearer than my old earbuds.", rating: 5 },
  { text: "The left earbud sometimes refuses to charge unless I reseat it in the case.", rating: 2 },
  { text: "Setup was quick and the app walked me through pairing without any trouble.", rating: 5 },
  { text: "I wish it could stay connected to two devices at the same time.", rating: 3 },
  { text: "Battery life easily gets me through a full workday.", rating: 5 },
  { text: "During Teams calls the connection drops for a few seconds and comes back.", rating: 1 },
  { text: "Music sounds balanced and the bass is strong without being muddy.", rating: 5 },
  { text: "The charging pins seem unreliable and one side was empty this morning.", rating: 2 },
  { text: "The controls are responsive, but I would like more customization in the app.", rating: 4 },
  { text: "Pairing was confusing the first time and the instructions were not very clear.", rating: 2 },
  { text: "Noise isolation is better than expected for commuting.", rating: 4 },
  { text: "I keep losing Bluetooth audio when I walk into the next room.", rating: 2 },
  { text: "The case is compact and charging is fast when both contacts connect properly.", rating: 4 },
  { text: "Please add multipoint connectivity so I can use my phone and work laptop together.", rating: 4 },
  { text: "Microphone quality is disappointing in busy rooms and coworkers struggle to hear me.", rating: 2 },
  { text: "The app looks polished, but finding the equalizer took longer than it should.", rating: 3 },
  { text: "The earbuds feel premium and are comfortable enough for long listening sessions.", rating: 5 },
  { text: "The right earbud disconnected twice during a forty minute call.", rating: 2 },
  { text: "I would love a custom EQ and more control over touch gestures.", rating: 4 },
  { text: "Charging is inconsistent after a few weeks and I have to clean the contacts often.", rating: 2 },
  { text: "Sound quality is great for podcasts and video calls.", rating: 5 },
  { text: "Switching devices is annoying because I have to disconnect one before pairing another.", rating: 2 },
  { text: "Battery percentage in the app is useful and seems accurate.", rating: 4 },
  { text: "The microphone is fine indoors, but wind noise makes outdoor calls difficult.", rating: 3 },
];

const REVIEW_VARIANTS = [
  "I noticed this during normal daily use.",
  "This has happened more than once over the last few days.",
  "It stood out after using the product for a couple of weeks.",
];

const SOURCES = ["Amazon", "Best Buy", "Direct", "Retail partner", "App review"];

const POSITIVE_WORDS = [
  "excellent",
  "great",
  "good",
  "love",
  "premium",
  "reliable",
  "fast",
  "clear",
  "quick",
  "comfortable",
  "balanced",
  "useful",
  "better",
  "polished",
  "strong",
];

const NEGATIVE_WORDS = [
  "disconnect",
  "disconnects",
  "disconnected",
  "drops",
  "confusing",
  "disappointing",
  "unreliable",
  "annoying",
  "difficult",
  "struggle",
  "refuses",
  "inconsistent",
  "trouble",
  "empty",
  "losing",
];

const THEME_RULES = [
  {
    label: "Bluetooth connectivity",
    keywords: ["bluetooth", "connection", "pair", "disconnect", "drops", "switching devices"],
    insight: "Connection instability is concentrated around calls, room-to-room movement, and device switching.",
    action: "Prioritize Bluetooth stability testing for calls and multi-device switching across common laptop and phone combinations.",
    priority: "High" as const,
  },
  {
    label: "Charging reliability",
    keywords: ["charging", "charge", "charging pins", "contacts", "case"],
    insight: "Customers describe intermittent earbud charging and contact reliability inside the case.",
    action: "Audit charging-contact complaints, reproduce partial-charge failures, and compare affected hardware batches.",
    priority: "High" as const,
  },
  {
    label: "Multipoint connectivity",
    keywords: ["multipoint", "two devices", "phone and work laptop", "device switching", "switching devices"],
    insight: "Customers want a smoother workflow between phones and laptops without manually reconnecting.",
    action: "Evaluate multipoint connectivity demand against implementation effort and add it to product discovery if feasible.",
    priority: "Opportunity" as const,
  },
  {
    label: "Sound quality",
    keywords: ["sound", "audio", "bass", "podcasts", "voices"],
    insight: "Audio quality is one of the strongest positive signals and helps offset hardware friction.",
    action: "Protect the current sound profile while addressing reliability issues that are lowering overall satisfaction.",
    priority: "Medium" as const,
  },
  {
    label: "App & setup",
    keywords: ["setup", "app", "instructions", "equalizer"],
    insight: "Onboarding is generally workable, but some customers struggle with setup clarity and feature discoverability.",
    action: "Simplify first-run pairing guidance and make high-value controls such as EQ easier to discover.",
    priority: "Medium" as const,
  },
  {
    label: "Call quality",
    keywords: ["microphone", "calls", "teams", "coworkers", "wind noise"],
    insight: "Call reliability and microphone performance create friction in work and outdoor environments.",
    action: "Test microphone performance in noisy environments and prioritize call-quality regressions in QA.",
    priority: "Medium" as const,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildSampleReviews(): DemoReview[] {
  return Array.from({ length: 75 }, (_, index) => {
    const blueprint = REVIEW_BLUEPRINTS[index % REVIEW_BLUEPRINTS.length];
    const cycle = Math.floor(index / REVIEW_BLUEPRINTS.length);
    const suffix = cycle === 0 ? "" : ` ${REVIEW_VARIANTS[(cycle - 1) % REVIEW_VARIANTS.length]}`;
    const day = 2 + (index % 28);
    const month = index < 25 ? "Aug" : index < 50 ? "Sep" : "Oct";

    return {
      id: `sample-${index + 1}`,
      text: `${blueprint.text}${suffix}`,
      rating: blueprint.rating,
      source: SOURCES[index % SOURCES.length],
      dateLabel: `${month} ${day}, 2026`,
    };
  });
}

const SAMPLE_REVIEWS = buildSampleReviews();

function analyzeReview(review: DemoReview, model: ModelChoice): DemoReview {
  const text = review.text.toLowerCase();
  const positiveHits = POSITIVE_WORDS.filter((word) => text.includes(word)).length;
  const negativeHits = NEGATIVE_WORDS.filter((word) => text.includes(word)).length;
  const lexical = positiveHits - negativeHits;
  const ratingSignal =
    review.rating == null ? 0 : review.rating >= 4 ? 1 : review.rating <= 2 ? -1 : 0;

  const score =
    model === "VADER"
      ? lexical * 1.2 + ratingSignal * 0.85
      : lexical * 0.9 + ratingSignal * 1.05;

  const sentiment: Sentiment =
    score > 0.35 ? "positive" : score < -0.35 ? "negative" : "neutral";

  return {
    ...review,
    sentiment,
    confidence: clamp(0.6 + Math.abs(score) * 0.11, 0.6, 0.96),
  };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseLocalCsv(csv: string): DemoReview[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const textIndex = headers.findIndex((header) =>
    ["text", "review", "review_text", "feedback"].includes(header)
  );
  const ratingIndex = headers.findIndex((header) => ["rating", "stars", "score"].includes(header));
  const sourceIndex = headers.findIndex((header) => header === "source");

  if (textIndex < 0) return [];

  return lines.slice(1).flatMap((line, index) => {
    const cells = parseCsvLine(line);
    const text = cells[textIndex]?.trim();
    if (!text) return [];

    const rawRating = ratingIndex >= 0 ? Number(cells[ratingIndex]) : NaN;
    const rating = Number.isFinite(rawRating) ? clamp(rawRating, 1, 5) : null;

    return [
      {
        id: `upload-${index + 1}`,
        text,
        rating,
        source: sourceIndex >= 0 && cells[sourceIndex] ? cells[sourceIndex] : "Uploaded CSV",
        dateLabel: "Uploaded now",
      },
    ];
  });
}

function stars(rating: number | null) {
  if (rating == null) return "No rating";
  return `${"★".repeat(Math.round(rating))}${"☆".repeat(5 - Math.round(rating))}`;
}

export default function DemoSandbox() {
  const [product, setProduct] = useState<DemoProduct>({
    name: "",
    category: "Consumer electronics",
  });
  const [created, setCreated] = useState(false);
  const [reviews, setReviews] = useState<DemoReview[]>([]);
  const [model, setModel] = useState<ModelChoice>("VADER");
  const [analyzed, setAnalyzed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [csvError, setCsvError] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [visibleReviews, setVisibleReviews] = useState(12);
  const [selectedTheme, setSelectedTheme] = useState<ThemeSignal | null>(null);
  const [humanLabels, setHumanLabels] = useState<Record<string, Sentiment>>({});

  const metrics = useMemo(() => {
    const analyzedReviews = reviews.filter((review) => review.sentiment);
    const positive = analyzedReviews.filter((review) => review.sentiment === "positive").length;
    const neutral = analyzedReviews.filter((review) => review.sentiment === "neutral").length;
    const negative = analyzedReviews.filter((review) => review.sentiment === "negative").length;
    const ratings = reviews
      .map((review) => review.rating)
      .filter((rating): rating is number => rating != null);
    const averageRating = ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : null;
    const sentimentScore = analyzedReviews.length
      ? ((positive - negative) / analyzedReviews.length) * 100
      : 0;

    const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: reviews.filter((review) => Math.round(review.rating ?? 0) === rating).length,
    }));

    const themes: ThemeSignal[] = THEME_RULES.map((theme) => {
      const evidence = reviews.filter((review) => {
        const text = review.text.toLowerCase();
        return theme.keywords.some((keyword) => text.includes(keyword));
      });
      const negativeCount = evidence.filter((review) => review.sentiment === "negative").length;

      return {
        label: theme.label,
        count: evidence.length,
        negativeCount,
        negativeShare: evidence.length ? (negativeCount / evidence.length) * 100 : 0,
        evidence,
        insight: theme.insight,
        action: theme.action,
        priority: theme.priority,
      };
    })
      .filter((theme) => theme.count > 0)
      .sort((a, b) => b.count - a.count);

    const buckets = Array.from({ length: 6 }, (_, bucketIndex) => {
      const start = Math.floor((reviews.length / 6) * bucketIndex);
      const end = Math.floor((reviews.length / 6) * (bucketIndex + 1));
      const bucket = analyzedReviews.slice(start, end);
      const bucketPositive = bucket.filter((review) => review.sentiment === "positive").length;
      const bucketNegative = bucket.filter((review) => review.sentiment === "negative").length;
      const positivePct = bucket.length ? (bucketPositive / bucket.length) * 100 : 0;
      const negativePct = bucket.length ? (bucketNegative / bucket.length) * 100 : 0;

      return {
        label: ["Aug W1", "Aug W3", "Sep W1", "Sep W3", "Oct W1", "Oct W3"][bucketIndex],
        positivePct,
        negativePct,
      };
    });

    return {
      positive,
      neutral,
      negative,
      averageRating,
      sentimentScore,
      ratingDistribution,
      themes,
      buckets,
    };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (reviewFilter === "all") return reviews;
    return reviews.filter((review) => review.sentiment === reviewFilter);
  }, [reviewFilter, reviews]);

  const humanReview = useMemo(
    () => reviews.find((review) => review.sentiment === "negative") ?? reviews[0],
    [reviews]
  );

  const analysisSteps = [
    "Normalizing customer feedback",
    "Classifying review sentiment",
    "Extracting recurring customer signals",
    "Linking evidence to findings",
    "Generating recommended next steps",
  ];

  function resetDemo() {
    const confirmed = window.confirm(
      "Restart interactive demo?\n\nThis clears your temporary product, reviews, analysis, and human-review changes. The shared Senvu dataset is never affected."
    );

    if (!confirmed) return;

    setProduct({ name: "", category: "Consumer electronics" });
    setCreated(false);
    setReviews([]);
    setModel("VADER");
    setAnalyzed(false);
    setAnalyzing(false);
    setAnalysisStage(0);
    setCsvError("");
    setReviewFilter("all");
    setVisibleReviews(12);
    setSelectedTheme(null);
    setHumanLabels({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function launchGuidedDemo() {
    setProduct({ name: "NovaSound Air", category: "Wireless audio" });
    setCreated(true);
    setReviews(SAMPLE_REVIEWS.map((review) => ({ ...review })));
    setAnalyzed(false);
    setAnalyzing(false);
    setAnalysisStage(0);
    setReviewFilter("all");
    setVisibleReviews(12);
    setCsvError("");
    setHumanLabels({});

    window.setTimeout(() => {
      document.getElementById("demo-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function createProduct() {
    if (!product.name.trim()) return;
    setCreated(true);
    setReviews([]);
    setAnalyzed(false);
    setHumanLabels({});
  }

  function loadSamples() {
    setReviews(SAMPLE_REVIEWS.map((review) => ({ ...review })));
    setAnalyzed(false);
    setReviewFilter("all");
    setVisibleReviews(12);
    setHumanLabels({});
    setCsvError("");
  }

  async function handleCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseLocalCsv(text).slice(0, 200);

    if (!parsed.length) {
      setCsvError(
        "Could not read review text. Use a CSV with a text/review column and optional rating/source columns."
      );
      return;
    }

    setReviews(parsed);
    setAnalyzed(false);
    setReviewFilter("all");
    setVisibleReviews(12);
    setHumanLabels({});
    setCsvError("");
    event.target.value = "";
  }

  function runAnalysis() {
    if (!reviews.length || analyzing) return;

    setAnalyzed(false);
    setAnalyzing(true);
    setAnalysisStage(0);

    analysisSteps.forEach((_, index) => {
      window.setTimeout(() => setAnalysisStage(index + 1), 320 + index * 330);
    });

    window.setTimeout(() => {
      setReviews((current) => current.map((review) => analyzeReview(review, model)));
      setAnalyzing(false);
      setAnalyzed(true);
      setReviewFilter("all");

      window.setTimeout(() => {
        document.getElementById("intelligence-results")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    }, 2100);
  }

  function applyHumanLabel(sentiment: Sentiment) {
    if (!humanReview) return;
    setHumanLabels((current) => ({ ...current, [humanReview.id]: sentiment }));
  }

  const sentimentTotal = Math.max(1, metrics.positive + metrics.neutral + metrics.negative);
  const maxRatingCount = Math.max(1, ...metrics.ratingDistribution.map((item) => item.count));
  const maxThemeCount = Math.max(1, ...metrics.themes.map((theme) => theme.count));
  const trendPoints = metrics.buckets
    .map((bucket, index) => {
      const x = metrics.buckets.length === 1 ? 0 : (index / (metrics.buckets.length - 1)) * 100;
      const y = 88 - bucket.positivePct * 0.72;
      return `${x},${clamp(y, 10, 88)}`;
    })
    .join(" ");

  return (
    <>
      <div className="breadcrumbs">
        <span>Interactive Demo</span>
        <span>/</span>
        <strong>Try Senvu</strong>
      </div>

      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroCopy}>
          <div className={styles.heroBadge}>✦ Interactive customer-intelligence sandbox</div>
          <h1>See 75 customer reviews become product decisions.</h1>
          <p>
            Create a temporary product, inspect realistic feedback, run a sentiment preview, uncover customer issues, and turn evidence into recommended next steps — without touching the shared Senvu database.
          </p>

          <div className={styles.heroActions}>
            <button type="button" className={styles.heroPrimary} onClick={launchGuidedDemo}>
              Launch the 75-review demo →
            </button>
            <span>About a one-minute walkthrough · no signup · no database writes</span>
          </div>
        </div>

        <div className={styles.heroPreview} aria-hidden="true">
          <div className={styles.previewTopline}>
            <span>Customer intelligence</span>
            <span className={styles.previewLive}>LIVE PREVIEW</span>
          </div>
          <div className={styles.previewKpis}>
            <div><strong>75</strong><span>Reviews</span></div>
            <div><strong>6</strong><span>Signals</span></div>
            <div><strong>3</strong><span>Actions</span></div>
          </div>
          <div className={styles.previewChart}>
            {[64, 42, 74, 52, 82, 68, 91, 76].map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className={styles.previewFinding}>
            <span className={styles.previewAlert}>!</span>
            <div>
              <strong>Bluetooth connectivity</strong>
              <span>High-impact customer friction detected</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.safetyStrip}>
        <div>
          <span className={styles.safetyDot} />
          <strong>Portfolio-safe sandbox</strong>
        </div>
        <p>Everything on this page lives only in this browser tab. Reloading or restarting clears it.</p>
        {(created || reviews.length > 0) && (
          <button type="button" onClick={resetDemo}>↻ Restart demo</button>
        )}
      </section>

      <section className={styles.progressRail} aria-label="Demo progress">
        {[
          ["1", "Product", created ? product.name : "Create a product"],
          ["2", "Feedback", reviews.length ? `${reviews.length} reviews loaded` : "Load feedback"],
          ["3", "Analysis", analyzed ? `${model} preview complete` : analyzing ? "Analyzing…" : "Run analysis"],
          ["4", "Intelligence", analyzed ? "Insights & actions ready" : "Discover what matters"],
        ].map(([number, label, detail], index) => {
          const complete = index === 0 ? created : index === 1 ? reviews.length > 0 : index >= 2 ? analyzed : false;
          const active =
            (!created && index === 0) ||
            (created && !reviews.length && index === 1) ||
            (reviews.length > 0 && !analyzed && index === 2) ||
            (analyzed && index === 3);

          return (
            <article
              key={label}
              className={`${styles.progressStep} ${complete ? styles.progressComplete : ""} ${active ? styles.progressActive : ""}`}
            >
              <div>{complete ? "✓" : number}</div>
              <span>{label}</span>
              <strong>{detail}</strong>
            </article>
          );
        })}
      </section>

      <section className={styles.setupGrid} id="demo-workspace">
        <article className={styles.setupCard}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.eyebrow}>01 · Product</span>
              <h2>Create a temporary product</h2>
            </div>
            {created && <span className={styles.donePill}>Ready</span>}
          </div>

          <label className={styles.fieldLabel}>
            <span>Product name</span>
            <input
              value={product.name}
              onChange={(event) => {
                setProduct((current) => ({ ...current, name: event.target.value }));
                setCreated(false);
                setReviews([]);
                setAnalyzed(false);
              }}
              placeholder="e.g. NovaSound Air"
            />
          </label>

          <label className={styles.fieldLabel}>
            <span>Category</span>
            <select
              value={product.category}
              onChange={(event) => setProduct((current) => ({ ...current, category: event.target.value }))}
            >
              <option>Consumer electronics</option>
              <option>Wireless audio</option>
              <option>Smart home</option>
              <option>Mobile</option>
              <option>Wearables</option>
              <option>Software</option>
              <option>Other</option>
            </select>
          </label>

          <button
            className={styles.primaryButton}
            type="button"
            disabled={!product.name.trim()}
            onClick={createProduct}
          >
            {created ? "Product ready ✓" : "Create temporary product"}
          </button>
        </article>

        <article className={`${styles.setupCard} ${!created ? styles.disabledCard : ""}`}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.eyebrow}>02 · Feedback</span>
              <h2>Load customer reviews</h2>
            </div>
            {reviews.length > 0 && <span className={styles.donePill}>{reviews.length} loaded</span>}
          </div>

          <button
            className={styles.sampleButton}
            type="button"
            disabled={!created}
            onClick={loadSamples}
          >
            <span className={styles.sampleIcon}>✦</span>
            <span>
              <strong>Load 75 sample reviews</strong>
              <small>Realistic ratings, sources, dates, praise, complaints, and feature requests.</small>
            </span>
            <b>→</b>
          </button>

          <label className={`${styles.uploadButton} ${!created ? styles.uploadDisabled : ""}`}>
            <span>Or upload your own local CSV</span>
            <small>text/review · rating · source</small>
            <input type="file" accept=".csv,text/csv" disabled={!created} onChange={handleCsv} />
          </label>

          {csvError && <div className={styles.error}>{csvError}</div>}
        </article>

        <article className={`${styles.setupCard} ${!reviews.length ? styles.disabledCard : ""}`}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.eyebrow}>03 · Analysis</span>
              <h2>Run customer intelligence</h2>
            </div>
            {analyzed && <span className={styles.donePill}>Complete</span>}
          </div>

          <div className={styles.modelPicker}>
            {(["VADER", "TextBlob"] as ModelChoice[]).map((choice) => (
              <button
                type="button"
                key={choice}
                disabled={!reviews.length || analyzing}
                className={`${styles.modelChoice} ${model === choice ? styles.modelSelected : ""}`}
                onClick={() => {
                  setModel(choice);
                  setAnalyzed(false);
                }}
              >
                <span>{choice}</span>
                <small>{choice === "VADER" ? "Lexicon-oriented" : "Polarity-oriented"}</small>
              </button>
            ))}
          </div>

          <button
            className={styles.runButton}
            type="button"
            disabled={!reviews.length || analyzing}
            onClick={runAnalysis}
          >
            {analyzing ? "Analyzing customer feedback…" : `✦ Run ${model} sandbox analysis`}
          </button>

          <p className={styles.modelDisclaimer}>
            Public demo analysis is deterministic and browser-side so visitors can interact without paid APIs or database writes.
          </p>
        </article>
      </section>

      {reviews.length > 0 && (
        <section className={styles.reviewExplorer}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Customer evidence</span>
              <h2>Browse the feedback behind the analysis</h2>
              <p>These are the actual temporary reviews being analyzed in this sandbox.</p>
            </div>
            <div className={styles.reviewCount}>{reviews.length} reviews</div>
          </div>

          <div className={styles.reviewToolbar}>
            {(["all", "positive", "neutral", "negative"] as ReviewFilter[]).map((filter) => {
              const count =
                filter === "all"
                  ? reviews.length
                  : reviews.filter((review) => review.sentiment === filter).length;

              return (
                <button
                  type="button"
                  key={filter}
                  disabled={filter !== "all" && !analyzed}
                  className={reviewFilter === filter ? styles.filterActive : ""}
                  onClick={() => {
                    setReviewFilter(filter);
                    setVisibleReviews(12);
                  }}
                >
                  {filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)}
                  <span>{filter === "all" || analyzed ? count : "—"}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.reviewGrid}>
            {filteredReviews.slice(0, visibleReviews).map((review) => (
              <article className={styles.reviewCard} key={review.id}>
                <div className={styles.reviewMeta}>
                  <span className={styles.stars}>{stars(review.rating)}</span>
                  <span>{review.source}</span>
                  <span>{review.dateLabel}</span>
                </div>
                <p>“{review.text}”</p>
                {review.sentiment && (
                  <div className={styles.reviewFooter}>
                    <span className={`${styles.sentimentPill} ${styles[review.sentiment]}`}>
                      {review.sentiment}
                    </span>
                    <span>{Math.round((review.confidence ?? 0) * 100)}% confidence</span>
                  </div>
                )}
              </article>
            ))}
          </div>

          {visibleReviews < filteredReviews.length && (
            <button
              type="button"
              className={styles.loadMore}
              onClick={() => setVisibleReviews((current) => current + 12)}
            >
              Show 12 more reviews
            </button>
          )}
        </section>
      )}

      {analyzing && (
        <section className={styles.analysisProgress}>
          <div className={styles.analysisOrb}>✦</div>
          <div>
            <span className={styles.eyebrow}>Senvu is working</span>
            <h2>Turning feedback into intelligence…</h2>
          </div>
          <div className={styles.analysisSteps}>
            {analysisSteps.map((step, index) => (
              <div key={step} className={analysisStage > index ? styles.analysisDone : ""}>
                <span>{analysisStage > index ? "✓" : index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {analyzed && (
        <section className={styles.results} id="intelligence-results">
          <div className={styles.resultsHero}>
            <div>
              <span className={styles.eyebrow}>Analysis complete</span>
              <h2>{product.name || "Temporary product"} customer intelligence</h2>
              <p>{reviews.length} reviews analyzed with the {model} sandbox preview.</p>
            </div>
            <div className={styles.completeBadge}>✓ Intelligence ready</div>
          </div>

          <div className={styles.kpiGrid}>
            <article>
              <span>Reviews analyzed</span>
              <strong>{reviews.length}</strong>
              <small>100% of loaded feedback</small>
            </article>
            <article>
              <span>Average rating</span>
              <strong>{metrics.averageRating == null ? "—" : metrics.averageRating.toFixed(2)}</strong>
              <small>out of 5 stars</small>
            </article>
            <article>
              <span>Sentiment score</span>
              <strong>{`${metrics.sentimentScore >= 0 ? "+" : ""}${metrics.sentimentScore.toFixed(1)}`}</strong>
              <small>positive share − negative share</small>
            </article>
            <article>
              <span>Customer signals</span>
              <strong>{metrics.themes.length}</strong>
              <small>evidence-linked themes</small>
            </article>
          </div>

          <div className={styles.chartGrid}>
            <article className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <div><strong>Sentiment mix</strong><span>How customers feel</span></div>
                <span>{model}</span>
              </div>
              <div className={styles.sentimentDonutWrap}>
                <div
                  className={styles.sentimentDonut}
                  style={{
                    background: `conic-gradient(var(--positive) 0 ${(metrics.positive / sentimentTotal) * 100}%, var(--neutral) ${(metrics.positive / sentimentTotal) * 100}% ${((metrics.positive + metrics.neutral) / sentimentTotal) * 100}%, var(--negative) ${((metrics.positive + metrics.neutral) / sentimentTotal) * 100}% 100%)`,
                  }}
                >
                  <div><strong>{reviews.length}</strong><span>reviews</span></div>
                </div>
                <div className={styles.sentimentLegend}>
                  <div><i className={styles.positiveDot} /><span>Positive</span><strong>{metrics.positive}</strong></div>
                  <div><i className={styles.neutralDot} /><span>Neutral</span><strong>{metrics.neutral}</strong></div>
                  <div><i className={styles.negativeDot} /><span>Negative</span><strong>{metrics.negative}</strong></div>
                </div>
              </div>
            </article>

            <article className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <div><strong>Rating distribution</strong><span>1–5 star customer ratings</span></div>
              </div>
              <div className={styles.ratingBars}>
                {metrics.ratingDistribution.map((item) => (
                  <div key={item.rating}>
                    <span>{item.rating} ★</span>
                    <div><i style={{ width: `${(item.count / maxRatingCount) * 100}%` }} /></div>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className={`${styles.chartCard} ${styles.trendCard}`}>
              <div className={styles.chartHeader}>
                <div><strong>Positive sentiment trajectory</strong><span>Six review windows across the sample set</span></div>
                <span>Trend</span>
              </div>
              <div className={styles.lineChart}>
                <div className={styles.gridLines}><i /><i /><i /><i /></div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Positive sentiment trend">
                  <polyline points={trendPoints} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
                  {metrics.buckets.map((bucket, index) => {
                    const x = metrics.buckets.length === 1 ? 0 : (index / (metrics.buckets.length - 1)) * 100;
                    const y = clamp(88 - bucket.positivePct * 0.72, 10, 88);
                    return <circle key={bucket.label} cx={x} cy={y} r="1.7" fill="currentColor" />;
                  })}
                </svg>
                <div className={styles.trendLabels}>
                  {metrics.buckets.map((bucket) => <span key={bucket.label}>{bucket.label}</span>)}
                </div>
              </div>
            </article>
          </div>

          <div className={styles.discoverySection}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>What Senvu discovered</span>
                <h2>Customer signals worth acting on</h2>
                <p>Every finding below links back to the reviews that produced it.</p>
              </div>
              <div className={styles.reviewCount}>{metrics.themes.length} signals</div>
            </div>

            <div className={styles.signalGrid}>
              {metrics.themes.slice(0, 6).map((theme, index) => (
                <article className={styles.signalCard} key={theme.label}>
                  <div className={styles.signalTop}>
                    <span className={`${styles.priorityPill} ${styles[`priority${theme.priority}`]}`}>
                      {theme.priority === "Opportunity" ? "↗ Opportunity" : `⚠ ${theme.priority} impact`}
                    </span>
                    <span>0{index + 1}</span>
                  </div>
                  <h3>{theme.label}</h3>
                  <div className={styles.signalMetrics}>
                    <span><strong>{theme.count}</strong> mentions</span>
                    <span><strong>{Math.round(theme.negativeShare)}%</strong> negative</span>
                  </div>
                  <div className={styles.signalBar}><i style={{ width: `${(theme.count / maxThemeCount) * 100}%` }} /></div>
                  <p>{theme.insight}</p>
                  <button type="button" onClick={() => setSelectedTheme(theme)}>
                    View {theme.evidence.length} supporting reviews →
                  </button>
                </article>
              ))}
            </div>
          </div>

          {metrics.themes[0] && (
            <section className={styles.flowCard}>
              <div className={styles.flowHeader}>
                <span className={styles.eyebrow}>Evidence → intelligence → action</span>
                <h2>See how Senvu turns raw feedback into a decision.</h2>
              </div>
              <div className={styles.flowSteps}>
                <div>
                  <span>01</span>
                  <small>Customer evidence</small>
                  <strong>{metrics.themes[0].count} reviews mention {metrics.themes[0].label.toLowerCase()}</strong>
                  <p>“{metrics.themes[0].evidence[0]?.text}”</p>
                </div>
                <b>→</b>
                <div>
                  <span>02</span>
                  <small>Intelligence</small>
                  <strong>{metrics.themes[0].label} is a high-signal customer theme</strong>
                  <p>{metrics.themes[0].insight}</p>
                </div>
                <b>→</b>
                <div>
                  <span>03</span>
                  <small>Recommended action</small>
                  <strong>Give the product team a concrete next step</strong>
                  <p>{metrics.themes[0].action}</p>
                </div>
              </div>
            </section>
          )}

          <section className={styles.nextStepsSection}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>Recommended next steps</span>
                <h2>What should the team do now?</h2>
                <p>Prioritized actions are generated from the strongest signals in this temporary dataset.</p>
              </div>
              <div className={styles.reviewCount}>Top 3 actions</div>
            </div>

            <div className={styles.actionList}>
              {metrics.themes.slice(0, 3).map((theme, index) => (
                <article key={theme.label}>
                  <div className={styles.actionRank}>{String(index + 1).padStart(2, "0")}</div>
                  <div className={styles.actionBody}>
                    <div className={styles.actionTopline}>
                      <span className={`${styles.priorityPill} ${styles[`priority${theme.priority}`]}`}>{theme.priority}</span>
                      <span>{theme.count} supporting mentions</span>
                    </div>
                    <h3>{theme.action.split(".")[0]}</h3>
                    <p><strong>Why:</strong> {theme.insight}</p>
                    <p><strong>Suggested next step:</strong> {theme.action}</p>
                    <button type="button" onClick={() => setSelectedTheme(theme)}>Review evidence →</button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {humanReview && (
            <section className={styles.humanReviewSection}>
              <div className={styles.humanReviewIntro}>
                <span className={styles.eyebrow}>Human-in-the-loop evaluation</span>
                <h2>Test the AI yourself.</h2>
                <p>Review one prediction and see how a human correction would become evaluation feedback.</p>
              </div>

              <article className={styles.humanReviewCard}>
                <div className={styles.humanQuote}>“{humanReview.text}”</div>
                <div className={styles.humanPrediction}>
                  <div>
                    <span>Senvu prediction</span>
                    <strong className={humanReview.sentiment ? styles[humanReview.sentiment] : ""}>
                      {humanReview.sentiment ?? "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Confidence</span>
                    <strong>{Math.round((humanReview.confidence ?? 0) * 100)}%</strong>
                  </div>
                </div>

                <div className={styles.humanPrompt}>Is the AI correct?</div>
                <div className={styles.humanButtons}>
                  {(["positive", "neutral", "negative"] as Sentiment[]).map((sentiment) => (
                    <button
                      type="button"
                      key={sentiment}
                      className={humanLabels[humanReview.id] === sentiment ? styles.humanSelected : ""}
                      onClick={() => applyHumanLabel(sentiment)}
                    >
                      {sentiment === humanReview.sentiment ? "✓ " : ""}
                      {sentiment[0].toUpperCase() + sentiment.slice(1)}
                    </button>
                  ))}
                </div>

                {humanLabels[humanReview.id] && (
                  <div className={styles.humanSaved}>
                    <strong>Human label saved for this sandbox session.</strong>
                    <span>
                      AI label: {humanReview.sentiment} · Human label: {humanLabels[humanReview.id]} · This would become evaluation feedback in a persisted workflow.
                    </span>
                  </div>
                )}
              </article>
            </section>
          )}

          <footer className={styles.demoFooter}>
            <div>
              <strong>Want to try another scenario?</strong>
              <span>Restart the sandbox and load another product or your own local CSV.</span>
            </div>
            <button type="button" onClick={resetDemo}>↻ Restart demo</button>
          </footer>
        </section>
      )}

      {selectedTheme && (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={() => setSelectedTheme(null)}>
          <aside className={styles.evidenceDrawer} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <span className={styles.eyebrow}>Supporting evidence</span>
                <h2>{selectedTheme.label}</h2>
                <p>{selectedTheme.evidence.length} linked reviews from this temporary dataset.</p>
              </div>
              <button type="button" onClick={() => setSelectedTheme(null)} aria-label="Close evidence panel">×</button>
            </div>

            <div className={styles.drawerInsight}>
              <strong>Why it matters</strong>
              <p>{selectedTheme.insight}</p>
            </div>

            <div className={styles.drawerReviews}>
              {selectedTheme.evidence.slice(0, 18).map((review) => (
                <article key={review.id}>
                  <div>
                    <span className={styles.stars}>{stars(review.rating)}</span>
                    <span>{review.source}</span>
                    {review.sentiment && <span className={`${styles.sentimentPill} ${styles[review.sentiment]}`}>{review.sentiment}</span>}
                  </div>
                  <p>“{review.text}”</p>
                </article>
              ))}
            </div>

            <div className={styles.drawerAction}>
              <span>Recommended next step</span>
              <strong>{selectedTheme.action}</strong>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
