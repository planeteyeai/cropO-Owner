/** Lightweight route/page loading fallback for Suspense. */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="page fade-in page-loader" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true">
        <span className="loading-spinner-dot" />
      </span>
      <p className="muted">{label}</p>
    </div>
  );
}
