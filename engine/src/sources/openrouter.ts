import fs from "fs";
import path from "path";
import https from "https";
import { OpenRouterModelRaw } from "../../types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/models";
const CACHE_PATH = path.join(process.cwd(), "cache", "openrouter-models.json");

export async function fetchOpenRouterModels(): Promise<OpenRouterModelRaw[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  // キーがある時だけ Authorization を付ける（キー無しでも動作）
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const payload = await fetchJson(OPENROUTER_URL, headers);

    if (!payload || typeof payload !== "object" || !Array.isArray((payload as any).data)) {
      throw new Error("OpenRouter response missing expected data[] array.");
    }

    const data = (payload as any).data as OpenRouterModelRaw[];

    // cache write（次回以降のフォールバック用に永続化）
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), "utf8");

    return data;
  } catch (err) {
    // 失敗しても止めない：キャッシュがあれば使う
    if (fs.existsSync(CACHE_PATH)) {
      try {
        const cached = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
        if (Array.isArray(cached)) {
          console.warn("[openrouter] fetch failed; using cached models:", CACHE_PATH);
          return cached as OpenRouterModelRaw[];
        }
      } catch (_) {
        // fallthrough
      }
    }

    // キャッシュすら無い初回でも止めない（空配列で続行）
    console.warn("[openrouter] fetch failed and no cache; continuing with empty model list.");
    return [];
  }
}

function fetchJson(url: string, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: "GET", headers },
      (res) => {
        const status = res.statusCode || 0;
        const chunks: Buffer[] = [];

        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (status < 200 || status >= 300) {
            return reject(new Error(`OpenRouter HTTP ${status}: ${body}`));
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}
