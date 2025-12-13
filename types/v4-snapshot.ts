export type SnapshotIndex = {
  version: string;
  updatedAt: string;
  modelsCount: number;
  fullCount: number;
  provisionalCount: number;
  notListedCount: number;
};

export type RankingEntry = {
  model: string;
  vendor: string;
  layer: string;
  score: number;
  scores?: Record<string, number>;
  updatedAt?: string;
};
