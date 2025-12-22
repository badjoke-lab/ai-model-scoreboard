cat > app/api/score/[slug]/route.ts <<'EOF'
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const revalidate = 0;

async function readV4Json(fileName: string) {
  const fullPath = path.join(process.cwd(), "public", "data", "v4", fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw);
}

function findInArrayBySlug(arr: any[], slug: string) {
  const s = slug.toLowerCase();
  return arr.find((x) => {
    const a = String(x?.slug ?? x?.id ?? x?.model ?? "").toLowerCase();
    return a === s;
  });
}

export async function GET(_req: Request, ctx: { params: { slug: string } }) {
  const slug = ctx.params.slug;

  try {
    const modelsRaw = await readV4Json("models.json");

    let model: any = null;

    if (Array.isArray(modelsRaw)) {
      model = findInArrayBySlug(modelsRaw, slug);
    } else if (modelsRaw && typeof modelsRaw === "object") {
      // ✅ your current format: { "openai-gpt-4.1-mini": {...}, ... }
      model = (modelsRaw as Record<string, any>)[slug] ?? null;
    }

    if (!model) {
      return NextResponse.json(
        { status: "not_found", slug },
        { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } }
      );
    }

    return NextResponse.json(
      { status: "ok", model },
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
