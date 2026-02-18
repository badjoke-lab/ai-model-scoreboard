"use client";

import Link from "next/link";
import { useState } from "react";

type LinksSectionProps = {
  links: string[];
  linksByType?: {
    official_page: string[];
    dev_activity: string[];
    paper: string[];
    audit: string[];
    other: string[];
  };
};

const MAX_VISIBLE_LINKS = 20;

const SECTION_ORDER = [
  { key: "official_page", label: "Official" },
  { key: "dev_activity", label: "Dev" },
  { key: "paper", label: "Paper" },
  { key: "audit", label: "Audit" },
] as const;

export default function LinksSection({ links, linksByType }: LinksSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const typedLinks =
    linksByType ??
    ({
      official_page: [],
      dev_activity: [],
      paper: [],
      audit: [],
      other: links,
    } as const);

  const otherLinks = typedLinks.other ?? [];
  const visibleOtherLinks = expanded ? otherLinks : otherLinks.slice(0, MAX_VISIBLE_LINKS);
  const hiddenCount = otherLinks.length - MAX_VISIBLE_LINKS;
  const hasAnyLinks =
    SECTION_ORDER.some(({ key }) => (typedLinks[key] ?? []).length > 0) || otherLinks.length > 0;

  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">Links</h2>
      <div className="mt-4 text-sm text-slate-300">
        {hasAnyLinks ? (
          <>
            <div className="space-y-4">
              {SECTION_ORDER.map(({ key, label }) => {
                const urls = typedLinks[key] ?? [];
                if (!urls.length) return null;
                return (
                  <div key={key}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {label}
                    </h3>
                    <ul className="mt-1 space-y-1">
                      {urls.map((url) => (
                        <li key={`${key}:${url}`}>
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
                  </div>
                );
              })}

              {otherLinks.length ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Other
                  </h3>
                  <ul className="mt-1 space-y-1">
                    {visibleOtherLinks.map((url) => (
                      <li key={`other:${url}`}>
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
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">No links recorded.</p>
        )}
      </div>
    </section>
  );
}
