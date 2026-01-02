export interface RunContext {
  timestamp: string;
  dateStamp: string;
  runId?: string;
}

export function resolveRunContext(): RunContext {
  const timestamp = resolveRunTimestamp();
  return {
    timestamp,
    dateStamp: toDateStamp(timestamp),
    runId: process.env.GITHUB_RUN_ID || process.env.RUN_ID || undefined,
  };
}

function resolveRunTimestamp(): string {
  const sourceEpoch = process.env.SOURCE_DATE_EPOCH;
  if (sourceEpoch) {
    const parsed = Number(sourceEpoch);
    if (Number.isFinite(parsed) && parsed > 0) {
      return new Date(parsed * 1000).toISOString();
    }
  }

  const snapshotTimestamp = process.env.SNAPSHOT_TIMESTAMP;
  if (snapshotTimestamp) {
    const parsed = Date.parse(snapshotTimestamp);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date().toISOString();
}

function toDateStamp(timestamp: string): string {
  const d = new Date(timestamp);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
