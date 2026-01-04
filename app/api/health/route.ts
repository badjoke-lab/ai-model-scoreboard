import { NextResponse } from "next/server";

import { loadV4SnapshotWithDiagnostics } from "@/lib/v4-snapshot";

export const revalidate = 0;

const MAX_ERRORS = 6;

function computeAgeSeconds(updatedAt: string | null): number | null {
  if (!updatedAt) return null;
  const timestamp = new Date(updatedAt).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.floor((Date.now() - timestamp) / 1000);
}

export async function GET() {
  try {
    const snapshot = await loadV4SnapshotWithDiagnostics();
    const updatedAt = snapshot.index?.meta?.updatedAt ?? null;
    const errors = snapshot.diagnostics.errors.slice(0, MAX_ERRORS);
    const status = errors.length ? "unavailable" : "ok";

    return NextResponse.json(
      {
        status,
        snapshot: {
          updatedAt,
          ageSeconds: computeAgeSeconds(updatedAt),
        },
        errors,
      },
      { headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: "unavailable",
        snapshot: {
          updatedAt: null,
          ageSeconds: null,
        },
        errors: [message],
      },
      { status: 503, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
