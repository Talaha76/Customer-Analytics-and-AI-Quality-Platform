export default function Loading() {
  return (
    <div className="loading-page" aria-label="Loading dashboard">
      <div className="skeleton skeleton-title" />
      <div className="skeleton-grid">
        {Array.from({ length: 6 }).map((_, i) => <div className="skeleton skeleton-card" key={i} />)}
      </div>
      <div className="skeleton skeleton-chart" />
    </div>
  );
}
