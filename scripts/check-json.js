"use strict";

const fs = require("fs");

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/check-json.js <path>");
  process.exit(1);
}

try {
  const raw = fs.readFileSync(target, "utf-8");
  JSON.parse(raw);
} catch (err) {
  console.error(`${target}\n${err.message}`);
  process.exit(1);
}
