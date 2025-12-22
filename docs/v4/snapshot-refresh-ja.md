# AMS v4 snapshot refresh guide (English)

This note documents how to regenerate AMS v4 JSON files with the private engine and copy them into the `ai-model-scoreboard` site. It is written as a quick checklist for operators.

---

## Prerequisites
- macOS environment
- `~/private-engine` — private AMS v4 engine repository
- `~/ai-model-scoreboard` — public site repository
- Work from the `main` branch for both repos

---

## 1) Update the engine (`private-engine`)
```bash
cd ~/private-engine
git pull origin main
npm install        # no-op when already installed
npm run snapshot   # updates output/*.json
```
Generated files include:
- `output/index.json`
- `output/rankings.json`
- `output/models.json`
- `output/not-listed.json`
- `output/history/YYYY-MM-DD.json`
- `output/logs/audit-YYYY-MM-DD.json`

---

## 2) Copy results to the site (`ai-model-scoreboard`)
```bash
cd ~/ai-model-scoreboard
mkdir -p public/data/v4
cp ~/private-engine/output/index.json      public/data/v4/index.json
cp ~/private-engine/output/rankings.json   public/data/v4/rankings.json
cp ~/private-engine/output/models.json     public/data/v4/models.json
cp ~/private-engine/output/not-listed.json public/data/v4/not-listed.json
```

---

## 3) Commit and push
```bash
cd ~/ai-model-scoreboard
git status
git diff public/data/v4
git add public/data/v4/index.json \
        public/data/v4/rankings.json \
        public/data/v4/models.json \
        public/data/v4/not-listed.json

git commit -m "chore(v4): refresh snapshot from private-engine"
git push origin main
```

---

## 4) Verify in the browser
- https://ai-model-scoreboard.vercel.app/
  - Check scores, ordering, and the "Snapshot updated" timestamp.
- https://ai-model-scoreboard.vercel.app/methodology
  - Confirm the page renders normally.
- If something looks wrong:
  - Inspect `public/data/v4/*.json` locally.
  - Check Vercel deployment logs for errors.

---

## Notes
- v4 runs as a single active version; v3 is a placeholder.
- When building an automated pipeline later, model it after steps 1–3 above.
