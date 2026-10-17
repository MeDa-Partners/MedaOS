'use client';

import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';

interface State<T> {
  /** Which request (deps + reload count) this result belongs to. */
  key: string | null;
  data: T | null;
  error: string | null;
}

/**
 * Runs an async loader whenever `deps` change and ignores stale responses.
 * Pass `enabled: false` to wait (e.g. until the active venture is known).
 * The previous data stays visible while a new request is in flight.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList, enabled = true) {
  const [state, setState] = useState<State<T>>({ key: null, data: null, error: null });
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const key = `${JSON.stringify(deps)}#${version}`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loaderRef.current().then(
      (data) => !cancelled && setState({ key, data, error: null }),
      (err) => !cancelled && setState((prev) => ({ key, data: prev.data, error: errorMessage(err) }))
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, key]);

  const setData = useCallback((update: T | null | ((prev: T | null) => T | null)) => {
    setState((prev) => ({
      ...prev,
      data: typeof update === 'function' ? (update as (p: T | null) => T | null)(prev.data) : update,
    }));
  }, []);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    data: state.data,
    error: state.key === key ? state.error : null,
    loading: enabled && state.key !== key,
    setData,
    reload,
  };
}
