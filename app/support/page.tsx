import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Support",
  description: "Support options for AI Model Scoreboard and the AIMS project.",
  path: "/support",
});

export default function SupportPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">AIMS · Support</p>
        <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">Support AIMS</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Help keep AI Model Scoreboard transparent, evidence-first, and publicly accessible.
        </p>
      </header>
      <section className="space-y-3 text-sm text-slate-300 sm:text-base">
        <p>
          AIMS is maintained by a small team. If you rely on the scoreboard, consider contributing
          to keep updates frequent and the data pipeline healthy.
        </p>
        <p>
          For sponsorships or collaboration requests, reach out via the project contact channels.
        </p>
      </section>
    </div>
  );
}
