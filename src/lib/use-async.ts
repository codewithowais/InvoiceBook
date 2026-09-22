"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/fetcher";

type State<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

// Process-lived stale-while-revalidate cache, keyed by the caller's `cacheKey`.
// Revisiting a page shows the last value instantly while a fresh fetch runs in
// the background. Cleared on a full reload (it lives only in memory).
const swrCache = new Map<string, unknown>();

/** Drop cached entries (e.g. after a mutation). Prefix match, or all. */
export function invalidateCache(prefix?: string) {
  if (!prefix) {
    swrCache.clear();
    return;
  }
  for (const key of swrCache.keys()) {
    if (key.startsWith(prefix)) swrCache.delete(key);
  }
}

/**
 * Small client hook for GET-style data loading with loading / error / refetch.
 * `deps` re-runs the fetch; `refetch()` forces a reload. Pass a `cacheKey`
 * (typically the request URL) to enable stale-while-revalidate: the cached
 * value renders immediately and a background fetch keeps it fresh.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  cacheKey?: string,
): State<T> & { refetch: () => void; setData: (d: T) => void } {
  const [state, setState] = useState<State<T>>(() => {
    const cached = cacheKey ? swrCache.get(cacheKey) : undefined;
    return cached !== undefined
      ? { data: cached as T, loading: false, error: null }
      : { data: null, loading: true, error: null };
  });
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);
  const fnRef = useRef(fn);
  const keyRef = useRef(cacheKey);

  useEffect(() => {
    fnRef.current = fn;
    keyRef.current = cacheKey;
  });

  useEffect(() => {
    const id = ++reqId.current;
    const key = keyRef.current;
    const cached = key ? swrCache.get(key) : undefined;

    // Show cached data instantly (revalidate quietly); otherwise show skeleton.
    if (cached !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: cached as T, loading: false, error: null });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState((s) => ({ ...s, loading: true, error: null }));
    }

    fnRef
      .current()
      .then((data) => {
        if (id !== reqId.current) return;
        if (key) swrCache.set(key, data);
        setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (id !== reqId.current) return;
        const message =
          err instanceof ApiError
            ? err.message
            : "We couldn't load this. Please try again.";
        setState((s) => ({ ...s, loading: false, error: message }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((d: T) => {
    if (keyRef.current) swrCache.set(keyRef.current, d);
    setState((s) => ({ ...s, data: d }));
  }, []);

  return { ...state, refetch, setData };
}
