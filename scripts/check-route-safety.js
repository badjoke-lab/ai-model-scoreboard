const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const ROUTES_ROOT = path.join(ROOT, "app");
const FORBIDDEN = [
  /^\s*cd\s+/i,
  /^\s*cat\s*>/i,
  /^\s*cat\s+<<['"]?EOF/i,
  /^\s*<<['"]?EOF/i,
  /^\s*(bash|sh)\s+-c/i,
];

function collectRouteFiles(startDir) {
  const items = fs.readdirSync(startDir, { withFileTypes: true });
  const files = [];

  for (const entry of items) {
    const fullPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(fullPath));
    } else if (entry.isFile() && entry.name === "route.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const hits = [];

  lines.forEach((line, idx) => {
    if (FORBIDDEN.some((re) => re.test(line))) {
      hits.push({ line: idx + 1, text: line.trim() });
    }
  });

  return hits;
}

function main() {
  const routes = collectRouteFiles(ROUTES_ROOT);
  const problems = [];

  for (const file of routes) {
    const hits = scanFile(file);
    hits.forEach((hit) => problems.push({ file, ...hit }));
  }

  if (problems.length) {
    console.error("Forbidden shell-like content detected in route handlers:");
    for (const issue of problems) {
      console.error(`- ${path.relative(ROOT, issue.file)}:${issue.line} → ${issue.text}`);
    }
    process.exit(1);
  }

  console.log(`Checked ${routes.length} route files; no shell commands detected.`);
}

main();
