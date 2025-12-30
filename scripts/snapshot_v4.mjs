import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { buildSnapshot, toPublicSnapshot } from "../lib/v4/snapshot.mjs";

const OUTPUT_DIR = path.join(process.cwd(), "output");
const PUBLIC_DIR = path.join(process.cwd(), "public", "data", "v4");

async function writeJson(filePath, data) {
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, payload, "utf8");
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function runSnapshot() {
  const snapshot = buildSnapshot();
  const publicSnapshot = toPublicSnapshot(snapshot);

  await ensureDir(OUTPUT_DIR);
  await ensureDir(PUBLIC_DIR);

  await Promise.all([
    writeJson(path.join(OUTPUT_DIR, "index.json"), { meta: snapshot.meta }),
    writeJson(path.join(OUTPUT_DIR, "models.json"), snapshot.models),
    writeJson(path.join(OUTPUT_DIR, "rankings.json"), snapshot.rankings),
    writeJson(path.join(OUTPUT_DIR, "not-listed.json"), snapshot.notListed),
  ]);

  await Promise.all([
    writeJson(path.join(PUBLIC_DIR, "index.json"), publicSnapshot.index),
    writeJson(path.join(PUBLIC_DIR, "models.json"), publicSnapshot.models),
    writeJson(path.join(PUBLIC_DIR, "rankings.json"), publicSnapshot.rankings),
    writeJson(path.join(PUBLIC_DIR, "not-listed.json"), publicSnapshot.notListed),
  ]);

  return snapshot;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSnapshot()
    .then((snapshot) => {
      console.log(
        `Wrote output snapshot with ${snapshot.rankings.length} ranked models (${snapshot.meta.updatedAt}).`
      );
    })
    .catch((error) => {
      console.error("Failed to build v4 snapshot:", error);
      process.exit(1);
    });
}
