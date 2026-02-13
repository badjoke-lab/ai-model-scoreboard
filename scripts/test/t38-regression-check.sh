#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:5001}"
OVERRIDE_MODEL="${OVERRIDE_MODEL:-meta-llama%2Fllama-3.1-8b-instruct}"
NON_OVERRIDE_MODEL="${NON_OVERRIDE_MODEL:-openai%2Fgpt-5-codex}"

printf '[T38] Base URL: %s\n' "$BASE"
printf '[T38] Override model: %s\n' "$OVERRIDE_MODEL"
printf '[T38] Non-override model: %s\n' "$NON_OVERRIDE_MODEL"

curl -sS "$BASE/api/v4/model/$OVERRIDE_MODEL" > /tmp/t38_override.json
node - <<'NODE'
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/t38_override.json', 'utf8'));
function assert(x, msg){ if(!x){ console.error('FAIL:', msg); process.exit(1);} }
assert(j.status === 'ok', 'override api status ok');
assert(Array.isArray(j.evidence) && j.evidence.length === 4, 'override evidence has 4');
const types = new Set(j.evidence.map(e => e.type));
['official_page', 'dev_activity', 'paper', 'audit'].forEach((t) => assert(types.has(t), `override evidence type ${t}`));
assert(Array.isArray(j.links) && j.links.length >= 1, 'override links non-empty');
assert(j.rawInputsBySource && typeof j.rawInputsBySource === 'object', 'override rawInputsBySource exists');
console.log('OK: overrides model basic checks');
NODE

curl -sS "$BASE/api/v4/model/$NON_OVERRIDE_MODEL" > /tmp/t38_non_override.json
node - <<'NODE'
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/tmp/t38_non_override.json', 'utf8'));
function assert(x, msg){ if(!x){ console.error('FAIL:', msg); process.exit(1);} }
assert(j.status === 'ok', 'non-override api status ok');
assert(Array.isArray(j.evidence) && j.evidence.length === 4, 'non-override evidence has 4');
for(const e of j.evidence){
  assert(typeof e.status === 'string' && e.status.length > 0, `evidence ${e.type}: status`);
  assert(Array.isArray(e.reasons) && e.reasons.length > 0, `evidence ${e.type}: reasons not empty`);
}
assert(Array.isArray(j.links) && j.links.length >= 1, 'non-override links non-empty');
console.log('OK: non-override model evidence checks');
NODE

curl -sS -D /tmp/t38_text_headers.txt "$BASE/models/$OVERRIDE_MODEL?format=text" -o /tmp/t38_text_body.txt
rg -n "200" /tmp/t38_text_headers.txt >/dev/null
test -s /tmp/t38_text_body.txt
rg -n "Evidence|Raw Inputs|Links|Overall" /tmp/t38_text_body.txt >/dev/null
printf 'OK: format=text\n'

rg -n "specMissingEvidence|withheld" components lib -S | sed -n '1,120p'
printf 'OK: flag consistency scan\n'

printf '[T38] All regression checks passed.\n'
