import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { V4ModelMetadata, V4RankingEntry, V4SnapshotMeta } from "@/lib/v4-snapshot";

export type V4Mode = "FIRST_VIEW" | "FETCHING" | "READY" | "NO_RESULTS" | "ERROR";

export type V4Filters = {
  query: string;
  provider: string;
  status: "all" | "adopted" | "provisional" | "denied";
};

export type V4SnapshotData = {
  meta: V4SnapshotMeta;
  rankings: V4RankingEntry[];
  models: Record<string, V4ModelMetadata>;
};

export type V4ErrorInfo = {
  message: string;
  endpoint: string;
  timestamp: string;
  detail?: string;
};

type UseV4StateMachineOptions<T> = {
  endpoint: string;
  initialData?: V4SnapshotData | null;
  initialFilters?: Partial<V4Filters>;
  timeoutMs?: number;
  getResults: (data: V4SnapshotData, filters: V4Filters) => T[];
};

type UseV4StateMachineReturn<T> = {
  mode: V4Mode;
  data: V4SnapshotData | null;
  results: T[];
  error: V4ErrorInfo | null;
  filters: V4Filters;
  touchedControls: boolean;
  setQuery: (value: string) => void;
  setProvider: (value: string) => void;
  setStatus: (value: V4Filters["status"]) => void;
  clearFilters: () => void;
  retryFetch: () => void;
  showAll: () => void;
  isFetching: boolean;
  hasInitialUrlFilters: boolean;
};

const DEFAULT_FILTERS: V4Filters = {
  query: "",
  provider: "",
  status: "all",
};

function readInitialQuery() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("q") ?? "";
}

export function useV4StateMachine<T>({
  endpoint,
  initialData = null,
  initialFilters,
  timeoutMs = 15000,
  getResults,
}: UseV4StateMachineOptions<T>): UseV4StateMachineReturn<T> {
  const initialQuery = readInitialQuery();
  const hasInitialUrlFilters = initialQuery.length > 0;
  const initialFiltersValue = useMemo(
    () => ({
      ...DEFAULT_FILTERS,
      query: initialQuery,
      ...initialFilters,
    }),
    [initialFilters, initialQuery]
  );

  const [filters, setFilters] = useState<V4Filters>(initialFiltersValue);
  const [touchedControls, setTouchedControls] = useState(hasInitialUrlFilters);
  const [data, setData] = useState<V4SnapshotData | null>(initialData);
  const [results, setResults] = useState<T[]>(() =>
    initialData ? getResults(initialData, initialFiltersValue) : []
  );
  const [mode, setMode] = useState<V4Mode>("FETCHING");
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<V4ErrorInfo | null>(null);
  const hasInitialUrlFiltersRef = useRef(hasInitialUrlFilters);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlQuery = readInitialQuery();
    if (urlQuery && urlQuery !== filters.query) {
      setFilters((prev) => ({ ...prev, query: urlQuery }));
      setTouchedControls(true);
      hasInitialUrlFiltersRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveMode = useCallback(
    (nextResults: T[], fetching: boolean) => {
      if (fetching) return "FETCHING" as V4Mode;

      const isDefaultFilters =
        !filters.query.trim() &&
        !filters.provider.trim() &&
        filters.status === "all";

      if (!touchedControls && !hasInitialUrlFiltersRef.current && isDefaultFilters) {
        return "FIRST_VIEW" as V4Mode;
      }

      return nextResults.length > 0 ? ("READY" as V4Mode) : ("NO_RESULTS" as V4Mode);
    },
    [filters, touchedControls]
  );

  const fetchSnapshot = useCallback(async () => {
    setIsFetching(true);
    setMode("FETCHING");
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const payload = (await response.json()) as V4SnapshotData;
      if (
        !payload ||
        !payload.meta ||
        !Array.isArray(payload.rankings) ||
        !payload.models ||
        typeof payload.models !== "object"
      ) {
        throw new Error("Snapshot response is missing required fields.");
      }
      setData(payload);
      const nextResults = getResults(payload, filters);
      setResults(nextResults);
      setIsFetching(false);
      setMode(resolveMode(nextResults, false));
    } catch (err: any) {
      const message =
        err?.name === "AbortError" ? "Request timed out." : String(err?.message ?? err);
      setError({
        message,
        endpoint,
        timestamp: new Date().toISOString(),
        detail: err?.stack ? String(err.stack) : undefined,
      });
      setIsFetching(false);
      setMode("ERROR");
    } finally {
      clearTimeout(timeoutId);
    }
  }, [endpoint, filters, getResults, timeoutMs, resolveMode]);

  useEffect(() => {
    fetchSnapshot();
    return () => {};
  }, [fetchSnapshot]);

  useEffect(() => {
    if (!data) return;
    if (error) return;
    const nextResults = getResults(data, filters);
    setResults(nextResults);
    setMode(resolveMode(nextResults, isFetching));
  }, [data, error, filters, getResults, isFetching, resolveMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (filters.query.trim()) {
      url.searchParams.set("q", filters.query.trim());
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url.toString());
  }, [filters.query]);

  const updateFilter = useCallback((next: Partial<V4Filters>) => {
    setTouchedControls(true);
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const clearFilters = useCallback(() => {
    setTouchedControls(true);
    setFilters(DEFAULT_FILTERS);
  }, []);

  const retryFetch = useCallback(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const showAll = useCallback(() => {
    setTouchedControls(true);
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    mode,
    data,
    results,
    error,
    filters,
    touchedControls,
    setQuery: (value: string) => updateFilter({ query: value }),
    setProvider: (value: string) => updateFilter({ provider: value }),
    setStatus: (value: V4Filters["status"]) => updateFilter({ status: value }),
    clearFilters,
    retryFetch,
    showAll,
    isFetching,
    hasInitialUrlFilters: hasInitialUrlFiltersRef.current,
  };
}
