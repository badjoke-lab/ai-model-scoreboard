import Link from "next/link";

type ReferencesListProps = {
  sections: Array<{
    label: string;
    urls: string[];
  }>;
};

export default function ReferencesList({ sections }: ReferencesListProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">References (deduped list)</h2>
      <div className="mt-4 space-y-4 text-sm text-slate-300">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{section.label}</p>
            {section.urls.length ? (
              <ul className="mt-2 space-y-1">
                {section.urls.map((url) => (
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
            ) : (
              <p className="mt-2 text-sm text-slate-400">No references recorded.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
