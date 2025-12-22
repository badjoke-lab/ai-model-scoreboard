cd ~/ai-model-scoreboard

cat > app/api/snapshot/route.ts <<'EOF'
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const revalidate = 0;

async function readV4Json(fileName: string) {
  const fullPath = path.join(process.cwd(), "public", "data", "v4", fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw);
}

function toModelsArray(modelsRaw: unknown): any[] {
  if (!modelsRaw) return [];
  if (Array.isArray(modelsRaw)) return modelsRaw;
  if (typeof modelsRaw === "object") return Object.values(modelsRaw as Record<string, any>);
  return [];
}

export async function GET() {
  try {
    const meta = await readV4Json("index.json");
    const rankings = await readV4Json("rankings.json");
    const modelsRaw = await readV4Json("models.json");

    const models = toModelsArray(modelsRaw);

    // minimal safety checks (fail fast with clear message)
    if (!meta || meta.version !== "v4") {
      return NextResponse.json(
        { status: "error", error: "Invalid snapshot meta (index.json)" },
        { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }
    if (!Array.isArray(rankings)) {
      return NextResponse.json(
        { status: "error", error: "rankings.json must be an array" },
        { status: 500, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    return NextResponse.json(
      { status: "ok", meta, rankings, models },
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
