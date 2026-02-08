import Link from "next/link";

type ReferencesListProps = {
  links: string[];
};

export default function ReferencesList({ links }: ReferencesListProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">Links</h2>
      <div className="mt-4 text-sm text-slate-300">
        {links.length ? (
          <ul className="space-y-1">
            {links.map((url) => (
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
          <p className="text-sm text-slate-400">No links recorded.</p>
        )}
      </div>
    </section>
  );
}
