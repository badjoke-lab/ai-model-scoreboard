import Link from "next/link";

import { buildPageMetadata } from "@/lib/metadata";

const resources = [
  {
    href: "https://github.com/badjoke-lab/ai-model-scoreboard/blob/main/docs/v4/overview.md",
    label: "AMS v4 overview",
    description: "What the leaderboard measures and how the AMS v4 release fits into the roadmap.",
  },
  {
    href: "https://github.com/badjoke-lab/ai-model-scoreboard/blob/main/docs/v4/snapshot-pipeline.md",
    label: "Snapshot pipeline",
    description: "How offline snapshots are generated and stored under /public/data/v4.",
  },
  {
    href: "https://github.com/badjoke-lab/ai-model-scoreboard/blob/main/docs/ams-v4-refresh.md",
    label: "Refreshing the site with a new snapshot",
    description: "Checklist for updating the live scoreboard with the latest v4 data files.",
  },
];

export const metadata = buildPageMetadata({
  title: "Documentation",
  description: "Reference material for the AMS v4 scoreboard and snapshot pipeline.",
  path: "/docs",
});

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">AMS · v4</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">Documentation</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            The live site is powered exclusively by AMS v4 snapshots stored under {" "}
            <code className="mx-1 rounded bg-slate-900/50 px-1.5 py-0.5 text-[0.75rem] text-slate-200">/public/data/v4</code>.
            Use the resources below for methodology, data refresh steps, and context on how scores are computed.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {resources.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-slate-800 bg-background/60 p-4 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-accent/10"
            target="_blank"
            rel="noreferrer"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-100 group-hover:text-accent">{item.label}</h2>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">External</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
