# AMS v4 Snapshot Refresh Guide

_This document describes how to refresh the offline AMS v4 snapshot and publish it to the public UI (ai-model-scoreboard)._

---

## 1. Run the v4 engine locally (private-engine)

Repository: `badjoke-lab/private-engine` (private)

```bash
cd /Users/lyla/private-engine

# Pull latest engine code
git pull origin main

# Install deps (usually a no-op)
npm install

# Generate a new snapshot
npm run snapshot
````

If it succeeds, you should see:

```text
[AMS v4] Engine starting...
[AMS v4] Engine finished successfully
```

Generated files (relative to repo root):

* `output/index.json`
* `output/models.json`
* `output/rankings.json`
* `output/not-listed.json`
* `output/history/YYYY-MM-DD.json`
* `output/logs/audit-YYYY-MM-DD.json`

---

## 2. Copy snapshot JSON to the public UI repo

Repository: `badjoke-lab/ai-model-scoreboard` (public)

The UI reads JSON from:

* `public/data/v4/index.json`
* `public/data/v4/models.json`
* `public/data/v4/rankings.json`
* `public/data/v4/not-listed.json`

Update them as follows:

1. Open `ai-model-scoreboard` on GitHub.

2. Navigate to `public/data/v4/`.

3. Click **“Add file” → “Upload files”**.

4. Drag & drop the four files from `private-engine/output`:

   * `output/index.json`
   * `output/models.json`
   * `output/rankings.json`
   * `output/not-listed.json`

5. Use a commit message like:

   > `Update AMS v4 snapshot (2025-12-11)`

6. Commit directly to `main`.

Vercel will deploy automatically.

---

## 3. Verify on /v4

Once the deployment finishes, open:

* `https://ai-model-scoreboard.vercel.app/v4`

Check that:

* Snapshot metadata matches the latest `index.json`

  * `version` is `v4`
  * `modelsCount` > 0
  * `updated` timestamp is current
* Rankings table shows expected models and scores.

If everything looks good, AMS v4 snapshot refresh is complete.
