"use client";

import Link from "next/link";
import { useState } from "react";

type LinksSectionProps = {
  links: string[];
};

const MAX_VISIBLE_LINKS = 20;

export default function LinksSection({ links }: LinksSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleLinks = expanded ? links : links.slice(0, MAX_VISIBLE_LINKS);
  const hiddenCount = links.length - MAX_VISIBLE_LINKS;

  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">Links</h2>
      <div className="mt-4 text-sm text-slate-300">
        {links.length ? (
          <>
            <ul className="space-y-1">
              {visibleLinks.map((url) => (
                <li key={url}>
                  <Link
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-accent hover:text-accent/80"
                  >
                    {url}
                  </Link>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="mt-3 text-sm font-semibold text-accent hover:text-accent/80"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-slate-400">No links recorded.</p>
        )}
      </div>
    </section>
  );
}
