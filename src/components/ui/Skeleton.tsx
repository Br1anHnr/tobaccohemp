/** Placeholder grid shown while catalog data loads. */
export function ProductGridSkeleton({
  count = 6,
  label = "Carregando produtos…",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div className="skeleton-wrap" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="product-grid skeleton-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div className="skeleton-card" key={i}>
            <div className="skeleton skeleton-media" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({ label = "Carregando página…" }: { label?: string }) {
  return (
    <div className="page-skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <div className="skeleton skeleton-line short" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
      </div>
    </div>
  );
}
