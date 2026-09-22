/**
 * Route-level loading fallback for the (app) group. Because these routes are
 * dynamic (auth-gated), Next would otherwise wait for the server before
 * swapping the page — this gives an instant top progress bar on every
 * navigation so a click feels responsive while the next page streams in.
 */
export default function AppLoading() {
  return (
    <div aria-live="polite" aria-busy="true" aria-label="Loading">
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full w-2/5 rounded-full bg-primary"
          style={{ animation: "loading-slide 1.1s ease-in-out infinite" }}
        />
      </div>
    </div>
  );
}
