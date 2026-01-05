/**
 * AMS v4 — Scoring Engine Entry Point (Skeleton)
 * ------------------------------------------------
 * This file orchestrates the complete scoring pipeline.
 * No implementation details or formulas are included.
 */

import { buildAdoptedModelData } from "./data-fetch";
import { normalizeData } from "./normalize";
import { scoreModels } from "./scoring";
import { assignLayers } from "./layer-assignment";
import { applyFallbacks } from "./fallback";
import { publishArtifacts, buildPublishPayload } from "./publish";
import { buildAdoptionArtifacts, loadSeedModels } from "./src/adoption";
import { fetchOpenRouterModels } from "./src/sources/openrouter";
import { buildEvidenceArtifacts } from "./src/enrichment";
import { validatePublishPayload } from "./src/validator";
import { resolveRunContext } from "./src/run-context";

export async function runEngine(): Promise<void> {
  const runContext = resolveRunContext();
  console.info("[AMS v4] Run context:", runContext);

  // 1. Intake (OpenRouter + seed)
  console.info("[AMS v4] Intake: fetching OpenRouter models.");
  const openRouterModels = await fetchOpenRouterModels();
  console.info(
    `[AMS v4] Intake: fetched ${openRouterModels.length} OpenRouter models.`
  );
  const seedModels = loadSeedModels();
  console.info(`[AMS v4] Intake: loaded ${seedModels.length} seed models.`);

  // 2. Adoption decisions
  console.info("[AMS v4] Adoption: applying rules.");
  const adoptionArtifacts = await buildAdoptionArtifacts({
    openRouterModels,
    seedModels,
    generatedAt: runContext.timestamp,
  });
  console.info(
    `[AMS v4] Adoption: adopted ${adoptionArtifacts.adoption.adopted.length}, provisional ${adoptionArtifacts.adoption.provisional.length}.`
  );

  // 3. Enrichment
  console.info("[AMS v4] Enrichment: collecting evidence.");
  const evidenceArtifacts = await buildEvidenceArtifacts(
    adoptionArtifacts.adoption,
    openRouterModels,
    {
      updatedAt: runContext.timestamp,
      runId: runContext.runId,
    }
  );
  console.info(
    `[AMS v4] Enrichment: built evidence for ${Object.keys(evidenceArtifacts.files).length} models.`
  );

  // 4. Scoring (adopted + provisional models only)
  console.info("[AMS v4] Scoring: normalizing and scoring models.");
  const raw = buildAdoptedModelData({
    decisions: adoptionArtifacts.decisions.decisions,
    openRouterModels,
    seedModels,
  });
  const normalized = normalizeData(raw);
  const corrected = applyFallbacks(normalized);
  const scored = scoreModels(corrected, evidenceArtifacts.files, {
    updatedAt: runContext.timestamp,
  });

  // 5. Layer assignment
  console.info("[AMS v4] Layer assignment.");
  const layered = assignLayers(scored, adoptionArtifacts.decisions.decisions);

  // 6. Validate output payload
  const payload = buildPublishPayload(
    layered,
    corrected,
    adoptionArtifacts,
    evidenceArtifacts,
    {
      updatedAt: runContext.timestamp,
      historyDateStamp: runContext.dateStamp,
    }
  );
  console.info("[AMS v4] Validation: validating output payload.");
  validatePublishPayload(payload);

  // 7. Publish artifacts (rankings.json, models.json, history, etc.)
  console.info("[AMS v4] Publish: writing artifacts.");
  await publishArtifacts(payload, {
    historyDateStamp: runContext.dateStamp,
  });
}

/**
 * If executed directly via `ts-node index.ts` (npm run snapshot),
 * run the engine and exit with a proper code.
 */
if (require.main === module) {
  runEngine()
    .then(() => {
      // ensure any pending async I/O flushes before exit
      process.exit(0);
    })
    .catch((err) => {
      console.error("[AMS v4] Engine failed:", err);
      process.exit(1);
    });
}
