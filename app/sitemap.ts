import type { MetadataRoute } from "next";

import { loadV4Leaderboard } from "@/lib/v4-snapshot";
import { SITE_URL } from "@/lib/metadata";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { meta } = await loadV4Leaderboard();
  const updatedAt = meta.updatedAt ? new Date(meta.updatedAt) : new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: updatedAt,
    },
    {
      url: `${SITE_URL}/v4`,
      lastModified: updatedAt,
    },
  ];
}
