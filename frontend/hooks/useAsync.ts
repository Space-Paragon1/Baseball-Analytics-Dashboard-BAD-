import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../utils/api";

type Dep = string | number | boolean | null | undefined;

interface AsyncState<T> {
  /** Latest loaded data. Kept while a new request is in flight, so tables don't flash. */
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Run an async loader whenever `deps` change. Responses for old deps are
 * ignored, so quickly changing a filter can't show results for an old filter.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: Dep[], enabled = true): AsyncState<T> {
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify([...deps, nonce]);
  const [result, setResult] = useState<{ key: string | null; data?: T; error: string | null }>({ key: null, error: null });
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loaderRef
      .current()
      .then((data) => !cancelled && setResult({ key, data, error: null }))
      .catch((e) => !cancelled && setResult((prev) => ({ key, data: prev.data, error: getErrorMessage(e) })));
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = result.key === key;
  return {
    data: result.data,
    error: current ? result.error : null,
    loading: enabled && !current,
    reload,
  };
}
