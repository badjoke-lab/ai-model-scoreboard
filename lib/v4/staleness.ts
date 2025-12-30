export function getSnapshotStaleness(
  updatedAt?: string | null,
  thresholdDays = 3
): { isStale: boolean; ageDays: number | null } {
  if (!updatedAt) return { isStale: false, ageDays: null };
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return { isStale: false, ageDays: null };
  const ageMs = Date.now() - date.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return { isStale: ageDays > thresholdDays, ageDays };
}
