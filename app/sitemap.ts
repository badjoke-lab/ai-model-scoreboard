import type { MetadataRoute } from "next";

import { loadV4Leaderboard } from "@/lib/v4-snapshot";
import { SITE_URL } from "@/lib/metadata";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { index } = await loadV4Leaderboard();
  const updatedAt = index.updatedAt ? new Date(index.updatedAt) : new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: updatedAt,
    },
    {
      url: `${SITE_URL}/scores`,
      lastModified: updatedAt,
    },
  ];
}
