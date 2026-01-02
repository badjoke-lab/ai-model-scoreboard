# AMS v4 — Snapshot Refresh (Local Publish)

This document describes the **Phase 1 (semi-automatic)** refresh flow:

- Run the private engine locally
- Copy the generated v4 JSON into the public UI repo
- Commit & push the UI repo

> Goal: **One command** updates the JSON, then you only `git commit && git push`.

---

## Phase 2: Automated GitHub Action (daily)

**Only one scheduled workflow exists** for the automated refresh:

* Workflow: `.github/workflows/update-v4-snapshot.yml`
* Schedule: daily at 06:00 UTC (also runnable via **Run workflow** → `workflow_dispatch`)
* What it does:
  1. Checks out `private-engine`, installs deps, and runs `npm run snapshot` to build `output/*.json`.
  2. Checks out `badjoke-lab/ai-model-scoreboard` into `ui/` using a PAT (`AI_MODEL_SCOREBOARD_PAT`).
  3. Copies the four v4 JSON files into `ui/public/data/v4/`.
  4. If there are changes, opens a PR against `main` with title `Update v4 snapshot (YYYY-MM-DD)`, applies the `snapshot` label (auto-merge eligible in the UI repo), and includes a body that lists `updatedAt`. When a PR is created or updated, the workflow prints the PR URL in the logs. No changes → the job exits cleanly.

### Required secret

* `AI_MODEL_SCOREBOARD_PAT` — must allow pushing branches and opening PRs in `badjoke-lab/ai-model-scoreboard`.

### How to run manually

1. Go to **Actions** → **Update v4 snapshot**.
2. Click **Run workflow** (branch `main`).
3. Wait for the PR to appear in `badjoke-lab/ai-model-scoreboard` (or the run to finish with “no changes”).

### How to verify a run (checklist)

Use the job logs in **Actions** → **Update v4 snapshot**. Confirm the exact log lines below.

**If no data changed (expected no PR):**

* `No changes to publish. No PR will be created.`

**If data changed (expected PR):**

* `title_date=YYYY-MM-DD`
* `updated_at=...` (from `output/index.json` → `.meta.updatedAt`)
* `changed=true`
* `PR: https://github.com/badjoke-lab/ai-model-scoreboard/pull/<number> (operation: created|updated)`

---

## Prerequisites

### 1) Repos must be sibling directories

You must have both repos in the same parent directory:

```

~/private-engine
~/ai-model-scoreboard

```

The publish script copies files to:

```

../ai-model-scoreboard/public/data/v4/

````

### 2) Node.js

Recommended: Node 20+ (you are on Node v20.x).

### 3) Install deps (first time)

```bash
cd ~/private-engine
npm install
````

---

## What gets generated

Running the engine creates artifacts under `private-engine/output/`:

* `output/index.json`
* `output/rankings.json`
* `output/models.json`
* `output/not-listed.json`
* `output/history/YYYY-MM-DD.json`
* `output/logs/audit-YYYY-MM-DD.json`

---

## Phase 1: Semi-automatic publish flow (recommended)

### Step 0) Make sure UI repo is clean (optional but recommended)

```bash
cd ~/ai-model-scoreboard
git status
```

If you have local changes you don't want, clean them first.

---

### Step 1) Pull latest UI main

```bash
cd ~/ai-model-scoreboard
git pull --rebase origin main
```

---

### Step 2) Run publish from private-engine (one command)

```bash
cd ~/private-engine
git pull origin main
npm run snapshot:publish
```

Expected output is one of:

* `No changes in public/data/v4 (already up to date).`

  * → Nothing to do.
* `Updated public/data/v4. Next: ...`

  * → Proceed to Step 3.

---

### Step 3) Commit & push in UI repo (only when "Updated")

```bash
cd ~/ai-model-scoreboard
git status

git add public/data/v4
git commit -m "Update v4 snapshot (YYYY-MM-DD)"
git push origin main
```

If push is rejected (non-fast-forward), do:

```bash
git pull --rebase origin main
git push origin main
```

---

## Troubleshooting

### `ERROR: Missing output file: .../output/index.json`

The engine did not generate output files.

Check:

```bash
cd ~/private-engine
rm -rf output
npm run snapshot
ls -la output
```

If `output/` is missing, ensure `index.ts` executes `runEngine()` when run directly.

---

### `ERROR: UI repo not found: .../ai-model-scoreboard`

Your repo layout is wrong. Fix it to:

```
~/private-engine
~/ai-model-scoreboard
```

---

## Notes

* Public site should only expose:

  * `/scores` (results)
  * `/methodology` (public explanation)
* Full internal spec stays private (private-engine).
