export type V4SnapshotMeta = {
  version: string;
  updatedAt: string;
  modelsCount: number;
  fullCount: number;
  provisionalCount: number;
  notListedCount: number;
};

export async function fetchSnapshotMeta(): Promise<V4SnapshotMeta> {
  const deploymentHost =
    typeof process !== "undefined" ? process.env.VERCEL_URL : undefined;
  const hostWithProtocol = deploymentHost
    ? deploymentHost.startsWith("http://") || deploymentHost.startsWith("https://")
      ? deploymentHost
      : `${deploymentHost.includes("localhost") ? "http" : "https"}://${deploymentHost}`
    : null;

  const baseUrl =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : hostWithProtocol ?? "http://localhost:3000";

  const response = await fetch(`${baseUrl}/data/v4/index.json`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch snapshot meta: ${response.status}`);
  }

  return response.json();
}
