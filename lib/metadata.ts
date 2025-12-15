import type { Metadata } from "next";

const SITE_NAME = "AI Model Scoreboard";
const SITE_URL = "https://ai-model-scoreboard.vercel.app";
const DEFAULT_DESCRIPTION =
  "Independent AI model rankings focused on transparent evidence, open metrics, and meaningful deltas.";
const DEFAULT_IMAGE = "/og.png";

interface BuildMetadataOptions {
  title: string;
  description: string;
  path: string;
  openGraphType?: "website" | "article";
  imageAlt?: string;
}

export const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "AI leaderboard",
    "model rankings",
    "Hugging Face scores",
    "open metrics",
    "AI transparency",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: `${SITE_NAME} | Transparent AI evaluations`,
    description:
      "Evidence-first AI model rankings with open metrics, transparent methods, and trustworthy benchmarks.",
    url: `${SITE_URL}/`,
    siteName: SITE_NAME,
    images: [
      {
        url: DEFAULT_IMAGE,
        width: 1200,
        height: 630,
        alt: "AI Model Scoreboard leaderboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "Evidence-first AI model rankings with open metrics, transparent methods, and trustworthy benchmarks.",
    images: [DEFAULT_IMAGE],
  },
};

export function buildPageMetadata({
  title,
  description,
  path,
  openGraphType = "website",
  imageAlt,
}: BuildMetadataOptions): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const url = `${SITE_URL}${path}`;
  const alt = imageAlt ?? `${title} | ${SITE_NAME}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: openGraphType,
      images: [
        {
          url: DEFAULT_IMAGE,
          width: 1200,
          height: 630,
          alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [DEFAULT_IMAGE],
    },
  };
}

export { DEFAULT_DESCRIPTION, DEFAULT_IMAGE, SITE_NAME, SITE_URL };
