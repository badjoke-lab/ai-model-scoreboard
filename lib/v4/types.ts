import type {
  V4ModelMetadata,
  V4RankingEntry,
  V4SnapshotMeta,
} from "@/lib/v4-snapshot";

export type V4SnapshotData = {
  meta: V4SnapshotMeta;
  rankings: V4RankingEntry[];
  models: Record<string, V4ModelMetadata>;
};

export type V4SnapshotApiError = {
  message: string;
  expectedPath?: string;
  debug?: any;
};

export type V4SnapshotApiResponse = {
  ok: boolean;
  snapshot?: V4SnapshotData;
  warnings: string[];
  error?: V4SnapshotApiError;
};
