import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Donation",
  description: "Donate to support AI Model Scoreboard and AIMS operations.",
  path: "/donation",
});

export default function DonationPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">AIMS · Donation</p>
        <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">Donate</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Direct contributions keep the AIMS scoreboard open, updated, and evidence-first.
        </p>
      </header>
      <section className="space-y-3 text-sm text-slate-300 sm:text-base">
        <p>
          We use donations to fund data collection, maintenance, and reporting. Thank you for
          supporting transparent AI evaluations.
        </p>
        <p>
          A public donation link will appear here. If you need to coordinate a larger grant,
          please contact the project team.
        </p>
      </section>
    </div>
  );
}
