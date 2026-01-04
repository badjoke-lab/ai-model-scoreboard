import { NextResponse } from "next/server";

import { loadV4SnapshotWithDiagnostics } from "@/lib/v4-snapshot";

export const revalidate = 0;

export async function GET() {
  try {
    const snapshot = await loadV4SnapshotWithDiagnostics();
    const hasErrors = snapshot.diagnostics.errors.length > 0;
    const updatedAt = snapshot.index?.updatedAt;
    const updatedDate = updatedAt ? new Date(updatedAt) : null;
    const ageSeconds =
      updatedDate && !Number.isNaN(updatedDate.getTime())
        ? Math.floor((Date.now() - updatedDate.getTime()) / 1000)
        : null;

    return NextResponse.json(
      {
        status: hasErrors ? "unavailable" : "ok",
        snapshot: {
          ageSeconds,
          updatedAt: updatedAt ?? null,
        },
        errors: hasErrors ? snapshot.diagnostics.errors.slice(0, 10) : undefined,
      },
      { headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: "unavailable", error: String(err?.message ?? err) },
      { status: 503, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
