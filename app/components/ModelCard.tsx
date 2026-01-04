import Link from "next/link";

import type { V4Model } from "@/types/v4";

interface ModelCardProps {
  model: V4Model;
  rank: number;
}

export function ModelCard({ model, rank }: ModelCardProps) {
  const formattedUpdatedAt = new Date(model.updatedAt).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <article className="rounded-2xl border border-slate-800 bg-background/60 p-4 shadow-lg transition hover:border-accent">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <span className="rounded-md border border-slate-800 px-2 py-1 font-semibold">
              #{rank}
            </span>
            <span className="rounded-md border border-slate-800 px-2 py-1 font-semibold">
              {model.vendor}
            </span>
          </div>
          <Link href={`/${model.slug}`} className="text-xl font-semibold text-slate-50 hover:text-accent">
            {model.name}
          </Link>
          <div className="flex flex-wrap gap-2 text-[0.7rem] text-slate-400">
            {model.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-800 px-2 py-1">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Overall</p>
          <p className="text-3xl font-semibold text-slate-50">{model.overall.toFixed(1)}</p>
          <p className="text-xs text-slate-500">Updated {formattedUpdatedAt}</p>
        </div>
      </div>
    </article>
  );
}
