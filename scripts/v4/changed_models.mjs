import { computeFingerprintState } from "./fingerprint.mjs";

const out = computeFingerprintState();
console.log(JSON.stringify(out, null, 2));
