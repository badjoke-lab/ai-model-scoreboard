"use client";

import { useState } from "react";

type Row = { label: string; address: string };

const ROWS: Row[] = [
  { label: "BTC", address: "bc1q7hywsjcem2vdn49c3cpl4fs8r3e5vvafde4lqs" },
  { label: "ETH (ERC-20)", address: "0x1ecc8f229d6b2eba7cb7a7daef1a057740ff8d77" },
  { label: "USDT (ERC-20)", address: "0x1ecc8f229d6b2eba7cb7a7daef1a057740ff8d77" },
  { label: "USDC (ERC-20)", address: "0x1ecc8f229d6b2eba7cb7a7daef1a057740ff8d77" },
  { label: "SOL", address: "2sUa17TPebZT4ZVUTHvCVnmf5VD4QA9zHs2ah2kL1bQp" },
  { label: "BNB (BEP-20)", address: "0x1ecc8f229d6b2eba7cb7a7daef1a057740ff8d77" },
  { label: "DOGE", address: "DGVDLqqnsYHbin3gnFHvvoaNBHdyTXokZg" },
  { label: "AVAX", address: "0x1ecc8f229d6b2eba7cb7a7daef1a057740ff8d77" },
];

function short(addr: string) {
  if (addr.length <= 22) return addr;
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`;
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export default function WalletAddresses() {
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 shadow-lg sm:p-6">
      <h2 className="text-base font-semibold text-slate-100">Wallet addresses</h2>
      <p className="mt-1 text-xs text-slate-400">Copy copies the full address.</p>

      <div className="mt-4 space-y-3">
        {ROWS.map((r) => (
          <div key={r.label} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">{r.label}</div>

                {/* PC: 全文を折り返しで表示 */}
                <div className="mt-2 hidden select-all break-all text-xs text-slate-300 sm:block">
                  {r.address}
                </div>

                {/* Mobile: 短縮表示＋下に全文（崩れ防止） */}
                <div className="mt-2 text-sm text-slate-200 sm:hidden">{short(r.address)}</div>
                <div className="mt-2 break-all text-[11px] text-slate-400 sm:hidden">
                  {r.address}
                </div>

                {copied === r.label ? (
                  <div className="mt-2 text-xs text-emerald-300">Copied.</div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={async () => {
                  await copyToClipboard(r.address);
                  setCopied(r.label);
                  window.setTimeout(() => setCopied((x) => (x === r.label ? null : x)), 1200);
                }}
                className="shrink-0 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-900"
              >
                Copy
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
