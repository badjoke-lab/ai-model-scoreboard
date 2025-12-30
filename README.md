# AI Model Scoreboard

AI Model Scoreboard (v4) showcases a composite leaderboard that blends reasoning, coding, chat, and safety subscores. The
App Router exposes matching APIs for the live snapshot, ranked leaderboard, and per-model scorecards used by the UI.

- Live site: https://ai-model-scoreboard.vercel.app/
- Snapshot API: `/api/snapshot` returns the data rendered by the UI
- Leaderboard API: `/api/leaderboard` returns normalized and sorted scores
- Score API: `/api/score/[slug]` returns a single normalized model by slug or id
- Health check: `/api/health` reports live fetch/cache/score status
- Methodology: https://ai-model-scoreboard.vercel.app/methodology

## Documentation
- [V4 Methodology Spec (internal)](docs/v4/methodology-spec.md)
- [V4 Output JSON Mapping](docs/v4/output-json-mapping.md)

## Getting started
Requirements:
- Node.js 18+
- npm 10+

Install dependencies and start the dev server:
```bash
npm install
npm run dev
```

## Testing
```bash
npm run lint
npx tsc --noEmit
```

## Data
- Development environments use sample data stored in `lib/data/sample.json`.
- Normalization and scoring logic lives in `lib/normalizers.ts` and is applied consistently across the API surface.

## Donation story
The `/donation` page keeps AI Model Scoreboard independent while production payment rails are finalized. It currently lists
placeholder Stripe Payment Link and Ko-fi URLs plus temporary BTC / ETH / USDT wallets so supporters can bridge the gap. Reach
out to hello@aimodelscoreboard.org for invoices, bank instructions, or verified wallet credentials.
