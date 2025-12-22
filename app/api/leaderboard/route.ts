cat > app/api/leaderboard/route.ts <<'EOF'
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const revalidate = 0;

async function readV4Json(fileName: string) {
  const fullPath = path.join(process.cwd(), "public", "data", "v4", fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw);
}

export async function GET() {
  try {
    const leaderboard = await readV4Json("rankings.json");

    if (!Array.isArray(leaderboard)) {
      return NextResponse.json(
        { status: "error", error: "rankings.json must be an array" },
        { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    // ensure sorted by total score desc (even if file already sorted)
    leaderboard.sort((a: any, b: any) => (b?.score ?? 0) - (a?.score ?? 0));

    return NextResponse.json(
      { status: "ok", leaderboard },
      { headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", error: String(err?.message ?? err) },
      { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }
}
EOF
