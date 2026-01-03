import { NextResponse } from "next/server";

import { loadV4SnapshotWithDiagnostics } from "@/lib/v4-snapshot";

export const revalidate = 0;

export async function GET(_req: Request, ctx: { params: { slug: string } }) {
  try {
    const slug = ctx?.params?.slug;
    if (!slug) {
      return NextResponse.json(
        { error: "Missing slug" },
        { status: 400, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    const snapshot = await loadV4SnapshotWithDiagnostics();
    const models = snapshot.models ?? {};
    const hit = models[slug];

    if (!hit) {
      return NextResponse.json(
        { error: "Not found", slug },
        { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    return NextResponse.json(hit, {
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
