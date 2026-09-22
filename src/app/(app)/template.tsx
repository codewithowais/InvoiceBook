/**
 * A `template` re-mounts on every navigation (unlike `layout`), so wrapping the
 * page in the fade-in animation gives a subtle transition between routes while
 * the app shell stays put. Respects prefers-reduced-motion (see globals.css).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
