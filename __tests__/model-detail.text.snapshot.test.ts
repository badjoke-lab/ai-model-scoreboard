import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { renderModelDetailText } from "@/lib/v4/render-detail-text";

function readJson(rel: string) {
  const p = path.join(process.cwd(), rel);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

describe("model detail text snapshot", () => {
  it("openai/gpt-5-codex", () => {
    const j = readJson("__tests__/fixtures/model-openai-gpt-5-codex.json");
    const txt = renderModelDetailText(j);

    expect(txt).toContain("## Model");
    expect(txt).toContain("## Overall");
    expect(txt).toContain("## Evidence");
    expect(txt).toContain("## Raw Inputs");
    expect(txt).toContain("## Breakdown");
    expect(txt).toContain("## Links");
    expect(txt).toContain("- official_page");
    expect(txt).toContain("- dev_activity");
    expect(txt).toContain("- paper");
    expect(txt).toContain("- audit");
    expect(txt).toContain("- openrouter");
    expect(txt).toContain("- huggingface");
    expect(txt).toContain("- github");
    expect(txt).toContain("- arxiv");
    expect(txt).toContain("- ops");

    expect(txt).toMatchSnapshot();
  });

  it("meta-llama/llama-3.1-8b-instruct", () => {
    const j = readJson("__tests__/fixtures/model-meta-llama-llama-3.1-8b-instruct.json");
    const txt = renderModelDetailText(j);

    expect(txt).toContain("## Model");
    expect(txt).toContain("## Overall");
    expect(txt).toContain("## Evidence");
    expect(txt).toContain("## Raw Inputs");
    expect(txt).toContain("## Breakdown");
    expect(txt).toContain("## Links");

    expect(txt).toMatchSnapshot();
  });
});
