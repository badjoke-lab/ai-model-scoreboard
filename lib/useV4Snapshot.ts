"use client";

import { useEffect, useMemo, useState } from "react";

import type { RankingEntry, SnapshotIndex } from "@/types/v4-snapshot";

const SNAPSHOT_INDEX_PATH = "/data/v4/index.json";
const SNAPSHOT_RANKINGS_PATH = "/data/v4/rankings.json";

type SnapshotState = {
  indexData: SnapshotIndex | null;
  rankings: RankingEntry[];
  loading: boolean;
  error: string | null;
};

export function useV4Snapshot() {
  const [state, setState] = useState<SnapshotState>({
    indexData: null,
    rankings: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const [indexRes, rankingsRes] = await Promise.all([
          fetch(SNAPSHOT_INDEX_PATH),
          fetch(SNAPSHOT_RANKINGS_PATH),
        ]);

        if (!indexRes.ok || !rankingsRes.ok) {
          throw new Error("Unable to load snapshot files");
        }

        const [indexJson, rankingsJson] = await Promise.all([
          indexRes.json(),
          rankingsRes.json(),
        ]);

        if (!isMounted) return;

        setState({
          indexData: indexJson,
          rankings: rankingsJson,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (!isMounted) return;

        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Something went wrong",
        }));
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const updatedLabel = useMemo(() => {
    if (!state.indexData?.updatedAt) return "—";
    return new Date(state.indexData.updatedAt).toLocaleString();
  }, [state.indexData?.updatedAt]);

  const sortedRankings = useMemo(
    () => [...state.rankings].sort((a, b) => b.score - a.score),
    [state.rankings],
  );

  return {
    ...state,
    updatedLabel,
    sortedRankings,
  };
}
