import Link from "next/link";

import {
  loadV4SnapshotWithDiagnostics,
  type V4RankingEntry,
  type V4SnapshotMeta,
  type V4ModelMetadata,
} from "@/lib/v4-snapshot";
import { V4_DIMENSIONS } from "@/lib/v4-dimensions";
import { getSnapshotStaleness } from "@/lib/v4/staleness";
import LeaderboardClient from "./LeaderboardClient";

export const dynamic = "force-static";

function formatUpdatedLabel(iso?: string | null) {
  if (!iso) return "unavailable";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unavailable";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validateSnapshot(
  meta: V4SnapshotMeta,
  rankings: V4RankingEntry[],
  models: Record<string, V4ModelMetadata>
) {
  const fatal: string[] = [];
  const warn: string[] = [];
  const seenModels = new Set<string>();

  // meta checks
  if (meta.version !== "v4") {
    fatal.push(`index.json: version must be "v4" (got "${String(meta.version)}")`);
  }
  if (!meta.updatedAt || Number.isNaN(new Date(meta.updatedAt).getTime())) {
    warn.push(`index.json: updatedAt looks invalid (${String(meta.updatedAt)})`);
  }
  if (!isFiniteNumber(meta.modelsCount) || meta.modelsCount < 0) {
    fatal.push(`index.json: modelsCount must be a non-negative number`);
  }

  // rankings checks
  if (!Array.isArray(rankings)) {
    fatal.push(`rankings.json: must be an array`);
  } else {
    if (rankings.length === 0) {
      fatal.push(`rankings.json: empty (0 entries)`);
    }

    if (isFiniteNumber(meta.modelsCount) && meta.modelsCount !== rankings.length) {
      fatal.push(
        `Mismatch: index.modelsCount (${meta.modelsCount}) !== rankings.length (${rankings.length})`
      );
    }

    for (let i = 0; i < rankings.length; i++) {
      const e = rankings[i];
      if (!e || typeof e !== "object") {
        fatal.push(`rankings.json: entry[${i}] is not an object`);
        break;
      }
      if (!e.model || typeof e.model !== "string") {
        fatal.push(`rankings.json: entry[${i}].model is missing/invalid`);
        break;
      }
      if (!e.vendor || typeof e.vendor !== "string") {
        fatal.push(`rankings.json: entry[${i}].vendor is missing/invalid`);
        break;
      }
      if (seenModels.has(e.model)) {
        fatal.push(`rankings.json: duplicate model slug "${e.model}"`);
        break;
      }
      seenModels.add(e.model);
      if (!models[e.model]) {
        fatal.push(`models.json: missing entry for "${e.model}"`);
        break;
      }
      if (!["full", "provisional", "rejected", "not-listed"].includes(e.layer)) {
        fatal.push(`rankings.json: entry[${i}].layer is invalid`);
        break;
      }
      if (!isFiniteNumber(e.score)) {
        fatal.push(`rankings.json: entry[${i}].score is missing/invalid`);
        break;
      }
      if (!e.scores || typeof e.scores !== "object") {
        fatal.push(`rankings.json: entry[${i}].scores is missing/invalid`);
        break;
      }
      const s = e.scores as Record<string, unknown>;
      for (const dimension of V4_DIMENSIONS) {
        if (!isFiniteNumber(s[dimension.key])) {
          fatal.push(
            `rankings.json: entry[${i}].scores.${dimension.key} is missing/invalid`
          );
          break;
        }
      }
      if (fatal.length) break;
    }

    for (let i = 1; i < rankings.length; i++) {
      const prev = rankings[i - 1];
      const current = rankings[i];
      if (prev.score < current.score) {
        fatal.push(`rankings.json: order must be score desc (index ${i - 1} before ${i})`);
        break;
      }
      if (prev.score === current.score && prev.model.localeCompare(current.model) > 0) {
        fatal.push(
          `rankings.json: tie-breaker must be model slug asc (index ${i - 1} before ${i})`
        );
        break;
      }
    }
  }

  return { fatal, warn };
}

function AlertBox({
  variant,
  title,
  items,
}: {
  variant: "error" | "warn";
  title: string;
  items: string[];
}) {
  if (!items.length) return null;

  const base = "rounded-2xl border px-4 py-3 text-sm shadow-sm";
  const cls =
    variant === "error"
      ? `${base} border-rose-500/30 bg-rose-500/10 text-rose-100`
      : `${base} border-amber-500/30 bg-amber-500/10 text-amber-100`;

  return (
    <div className={cls}>
      <div className="font-semibold">{title}</div>
      <ul className="mt-2 list-disc pl-5 space-y-1 text-[0.85rem]">
        {items.slice(0, 8).map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {items.length > 8 ? (
        <div className="mt-2 text-xs opacity-80">…and {items.length - 8} more</div>
      ) : null}
    </div>
  );
}

export default async function V4Page() {
  const snapshot = await loadV4SnapshotWithDiagnostics();
  const meta = snapshot.index?.meta ?? null;
  const rankings = snapshot.rankings ?? null;
  const models = snapshot.models ?? null;
  const lastUpdatedLabel = formatUpdatedLabel(meta?.updatedAt);

  const validation = meta && rankings && models ? validateSnapshot(meta, rankings, models) : null;
  const warn = validation ? [...validation.warn] : [];
  const fatal = validation ? [...validation.fatal] : [];

  if (snapshot.diagnostics.errors.length) {
    fatal.unshift(...snapshot.diagnostics.errors);
  }
  if (snapshot.diagnostics.warnings?.length) {
    warn.unshift(...snapshot.diagnostics.warnings);
  }

  const staleness = getSnapshotStaleness(meta?.updatedAt, 3);
  if (staleness.isStale) {
    const days = staleness.ageDays ? Math.floor(staleness.ageDays) : 0;
    warn.unshift(
      `Update stalled: last updated ${days || 0} day${days === 1 ? "" : "s"} ago`
    );
  }

  const missingEnrichment = [
    snapshot.diagnostics.files.enrichment.error,
    snapshot.diagnostics.files.enrichmentDecisions.error,
  ].filter(Boolean);

  if (!meta || !rankings || !models) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-4">
        <h1 className="text-3xl font-semibold text-slate-50">Leaderboard</h1>
        <p className="text-xs text-slate-400">Last updated: {lastUpdatedLabel}</p>
        <AlertBox
          variant="error"
          title="Snapshot load error"
          items={fatal.length ? fatal : ["Missing required v4 snapshot files."]}
        />
      </main>
    );
  }

  // If broken, do not render leaderboard.
  if (fatal.length) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            AIMS · v4
          </p>
          <h1 className="text-3xl font-semibold text-slate-50 md:text-4xl">
            Leaderboard
          </h1>
          <p className="text-xs text-slate-400">Last updated: {lastUpdatedLabel}</p>
          <p className="text-sm text-slate-400">
            Snapshot validation failed, so the leaderboard is temporarily hidden.
            Please check the snapshot generation/copy/commit pipeline.
          </p>
        </header>

        <AlertBox variant="error" title="Validation errors" items={fatal} />
        <AlertBox variant="warn" title="Warnings" items={warn} />

        <div className="text-sm text-slate-400 space-y-2">
          <div>Snapshot: {meta.version}</div>
          <div>Updated: {lastUpdatedLabel}</div>
          <div className="pt-2">
            <Link
              href="/methodology"
              className="text-xs font-medium text-accent hover:text-accent/80"
            >
              Read methodology →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
          AIMS · v4
        </p>

        <div className="space-y-3">
          <AlertBox variant="warn" title="Snapshot warnings" items={warn} />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-50 md:text-4xl">
              Leaderboard
            </h1>
            <p className="text-xs text-slate-400">Last updated: {lastUpdatedLabel}</p>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Rankings based on the latest snapshot generated by the AMS v4 engine.
              Total blends Spec, Evidence, and Ops scores.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="text-xs text-slate-400">
              <div>Snapshot: {meta.version}</div>
              <div>Updated: {lastUpdatedLabel}</div>
            </div>
            <div className="flex flex-wrap gap-2 text-[0.7rem] text-slate-300">
              <span className="rounded-full border border-slate-700 px-2 py-0.5">
                Models: {meta.modelsCount}
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5">
                Full: {meta.fullCount}
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5">
                Provisional: {meta.provisionalCount}
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5">
                Not listed: {meta.notListedCount}
              </span>
            </div>
            <Link
              href="/methodology"
              className="text-xs font-medium text-accent hover:text-accent/80"
            >
              Read methodology →
            </Link>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {missingEnrichment.length ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Enrichment signals unavailable (missing: {missingEnrichment.join(", ")})
          </div>
        ) : null}
        <LeaderboardClient
          rankings={rankings}
          models={models}
          evidenceSummaries={snapshot.evidenceSummaries ?? {}}
        />
      </div>
    </main>
  );
}
