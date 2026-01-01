# AMS v4 — Operations, Validation, Debugging (Hard Stop + Clear Logs)

## 0. Principle
v4 must be operable without guesswork:
- If it breaks, it stops.
- You can immediately tell why from logs.
- No manual intervention required for daily growth.

---

## 1. Required Daily Log Format (Minimum Fields)
Every run must output (structured log or consistent lines):

### Always
- `runId`
- `updatedAt`
- `changed=true|false`
- `stage` (one of: intake|normalize|decisions|evidence|scoring|validate|copy|diff|pr)
- `modelsTotal`
- `adoptedCount`
- `provisionalCount`
- `deniedCount`

### If PR created/updated
- `prUrl`
- `branchName`

### On failure
- `failedStage`
- `failReason` (short)
- `failDetail` (actionable)
- `hint` (what to check)

---

## 2. Fail-Fast Rules (Must Stop)
Job fails if:
- Missing secrets (OpenRouter key etc.)
- Intake non-200 or invalid JSON
- Validator fails any output file
- Evidence collection throws unhandled error
- Scoring produces missing items or invalid scores
- Copy-to-UI checkout/push fails

No partial publishing allowed.

---

## 3. Validation Rules (Strict)
Validator must enforce:
- All required files exist (section3)
- All enums are valid (no unknown)
- reasons[] is present and non-empty in:
  - decisions entries
  - evidence items
- evidence per model includes exactly the 4 types
- models.json includes all scoring items for all models
- rankings sorted and consistent
- manifest references correct paths

Failure output must include:
- file path
- json path
- rule message

---

## 4. Repro / Debug Procedures (Fixed)
### Local reproduction
- Run the same pipeline locally with:
  - same config files
  - same env secrets
  - output to local output/v4
- Run validator locally on produced files.

### CI reproduction
- Re-run workflow job with same commit.
- Logs must show:
  - which stage failed
  - what exact key/file broke

---

## 5. Determinism Rules
To guarantee deterministic output:
- Stable sort orders:
  - modelKey sorting where applicable
  - rankings tie-breakers fixed (overall desc then modelKey)
- Normalization rules fixed and documented (section2/3)
- Avoid non-deterministic iteration over object keys (sort keys when serializing if needed)
- Record `meta.updatedAt` from pipeline timestamp, not from scattered sub-steps

---

## 6. “Stop but explain” Examples
- Missing OpenRouter key:
  - failedStage=intake
  - failReason=missing_secret
  - failDetail=OPENROUTER_API_KEY not set
- Validator fail:
  - failedStage=validate
  - failReason=schema_invalid
  - failDetail=public/data/v4/evidence/foo.json evidenceItems[2].reasons is empty
- Evidence blocked:
  - NOT a pipeline failure; it is a valid result:
    - evidence status=blocked with reasons like ["403"]

Only structural/schema failures stop the pipeline.
