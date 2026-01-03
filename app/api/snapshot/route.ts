import { NextResponse } from "next/server";

import { loadV4SnapshotWithDiagnostics } from "@/lib/v4-snapshot";

export const revalidate = 0;

export async function GET() {
  try {
    const snapshot = await loadV4SnapshotWithDiagnostics();

    if (!snapshot.index || !snapshot.rankings || !snapshot.models) {
      return NextResponse.json(
        { error: "Snapshot data missing", issues: snapshot.diagnostics.errors },
        { status: 503, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    if (snapshot.diagnostics.errors.length) {
      return NextResponse.json(
        { error: "Snapshot validation failed", issues: snapshot.diagnostics.errors },
        { status: 503, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    return NextResponse.json(
      {
        meta: snapshot.index,
        rankings: snapshot.rankings,
        models: snapshot.models,
        notListed: snapshot.notListed ?? [],
      },
      { headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
