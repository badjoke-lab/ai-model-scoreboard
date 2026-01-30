import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL.replace(/\/+$/, "");
  const paths = ["/", "/methodology", "/support", "/donation"];

  return paths.map((path) => ({
    url: `${base}${path}`,
  }));
}
