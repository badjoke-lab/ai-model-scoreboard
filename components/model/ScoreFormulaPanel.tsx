import React from "react";

import { FORMULAS } from "@/lib/v4/formulas";

type Props = { defaultOpen?: boolean };

export default function ScoreFormulaPanel({ defaultOpen = false }: Props) {
  return (
    <details
      className="mt-6 rounded-xl border border-neutral-200/60 p-4 dark:border-neutral-800/60"
      open={defaultOpen}
    >
      <summary className="cursor-pointer select-none text-sm font-semibold">
        Score formulas (display only)
      </summary>

      <div className="mt-3 space-y-4 text-sm">
        <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900/40">
          <div className="font-semibold">{FORMULAS.overall.title}</div>
          <div className="mt-1 whitespace-pre-wrap font-mono text-xs">{FORMULAS.overall.formulaText}</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-neutral-600 dark:text-neutral-300">
            {FORMULAS.overall.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <div className="font-semibold">Category formulas</div>
          {FORMULAS.categories.map((category) => (
            <div
              key={category.id}
              className="rounded-lg border border-neutral-200/60 p-3 dark:border-neutral-800/60"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">{category.title}</div>
                <div className="text-xs text-neutral-500">{category.id}</div>
              </div>
              <div className="mt-1 whitespace-pre-wrap font-mono text-xs">{category.formulaText}</div>
              {category.notes?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-neutral-600 dark:text-neutral-300">
                  {category.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
