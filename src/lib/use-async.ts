"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/fetcher";

type State<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

/**
 * Small client hook for GET-style data loading with loading / error / refetch.
 * `deps` re-runs the fetch (e.g. when search or filter changes); `refetch()`
 * forces a reload. It synchronises the component with an external system (the
 * API), which is the intended use of an effect here. (Frontend-owned helper.)
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
): State<T> & { refetch: () => void; setData: (d: T) => void } {
  const [state, setState] = useState<State<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);
  const fnRef = useRef(fn);

  // Keep the latest fetcher without making it a dependency (it's usually an
  // inline closure that changes every render).
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    const id = ++reqId.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => {
        if (id === reqId.current) setState({ data, loading: false, error: null });
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
    setState((s) => ({ ...s, data: d }));
  }, []);

  return { ...state, refetch, setData };
}
