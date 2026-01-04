export type V4ScoreBreakdown = {
  spec: number;
  evidence: number;
  ops: number;
};

export type V4DeltaBreakdown = V4ScoreBreakdown & {
  overall: number;
};

export interface V4Model {
  id: string;
  slug: string;
  name: string;
  vendor: string;
  modality: string[];
  summary: string;
  scores: V4ScoreBreakdown;
  overall: number;
  updatedAt: string;
  tags: string[];
  delta30d: V4DeltaBreakdown;
}

export interface V4SnapshotResponse {
  status: "ok";
  models: V4Model[];
}

export interface V4LeaderboardResponse {
  status: "ok";
  leaderboard: V4Model[];
}

export interface V4ModelResponse {
  status: "ok";
  model: V4Model | null;
}
