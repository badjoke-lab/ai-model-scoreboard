import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Methodology",
  description: "High-level overview of how AI Model Scoreboard v4 scores are produced.",
  path: "/methodology",
});

export default function MethodologyPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">AI Model Scoreboard · v4</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">AI Model Scoreboard v4 · Methodology</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            How the v4 scores are produced (high-level overview).
          </p>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Last updated: 2025-12-14</p>
        </div>
      </header>

      <section className="space-y-4 text-sm text-slate-300 sm:text-base">
        <p>
          This page explains <strong>how the scores on AI Model Scoreboard v4 are produced</strong> at a high level.
        </p>
        <p>It is intentionally written to be:</p>
        <ul className="list-disc space-y-2 pl-6 text-slate-300">
          <li>Transparent enough for users to understand what the numbers roughly mean</li>
          <li>Stable enough that we don’t change the rules every week</li>
          <li>
            Specific enough to be useful, <strong>without exposing every internal detail or exact weight</strong>
          </li>
        </ul>
        <p>
          The goal is to give you a mental model of how the scoreboard thinks about models – not a step-by-step recipe to
          “game” the ranking.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-50">1. What is AMS v4 trying to measure?</h2>
        <p className="text-sm text-slate-300 sm:text-base">AMS v4 is a <strong>comparative scoreboard for large language models</strong>.</p>
        <p className="text-sm text-slate-300 sm:text-base">We focus on three questions:</p>
        <ol className="list-decimal space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
          <li>
            <em>“How strong is this model in real use?”</em>
          </li>
          <li>
            <em>“How safe and reliable is it to depend on?”</em>
          </li>
          <li>
            <em>“Is it a realistic choice for teams and developers to adopt?”</em>
          </li>
        </ol>
        <p className="text-sm text-slate-300 sm:text-base">
          To answer these, v4 combines multiple public signals into a single score between <strong>0–100</strong>.
        </p>
        <p className="text-sm text-slate-300 sm:text-base">The scoring is <strong>fully offline</strong>:</p>
        <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
          <li>A private engine gathers data from public sources</li>
          <li>Scores are computed in batches as “snapshots”</li>
          <li>
            The public site only reads static JSON snapshots (<code className="rounded bg-slate-900/60 px-1 py-0.5">public/data/v4/*.json</code>)
          </li>
        </ul>
        <p className="text-sm text-slate-300 sm:text-base">There is <strong>no live API call</strong> to any vendor’s service when you load the website.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-50">2. Which models are included?</h2>
        <p className="text-sm text-slate-300 sm:text-base">AMS v4 only tracks models that meet some basic baseline:</p>
        <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
          <li>The model is accessible to the public (API or SaaS)</li>
          <li>There is enough public information to estimate performance and cost</li>
          <li>The model is still maintained (not clearly abandoned)</li>
        </ul>
        <p className="text-sm text-slate-300 sm:text-base">Each model is assigned to one of three layers:</p>
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-background/50 p-5">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-100">Full</h3>
            <p className="text-sm text-slate-300 sm:text-base">
              Models with solid data across multiple dimensions. They are part of the main scoreboard.
            </p>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-100">Provisional</h3>
            <p className="text-sm text-slate-300 sm:text-base">
              Models where data is incomplete, noisy, or in transition. They appear on the scoreboard, but parts of the
              score may rely on estimates.
            </p>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-100">Rejected</h3>
            <p className="text-sm text-slate-300 sm:text-base">
              Models that are excluded from the main list. Reasons can include:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
              <li>Extremely poor transparency</li>
              <li>Repeated incidents or withdrawals</li>
              <li>Clearly abandoned or no longer available</li>
              <li>Not enough information to assign a responsible score</li>
            </ul>
            <p className="text-sm text-slate-300 sm:text-base">
              Rejected models are <strong>not shown on the main leaderboard</strong>, but the engine keeps track of them
              internally to avoid flip-flopping.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-50">3. The five score pillars</h2>
        <p className="text-sm text-slate-300 sm:text-base">
          Each model is evaluated along <strong>five pillars</strong>. The final 0–100 score is a blend of these; performance has the largest impact.
        </p>
        <p className="text-sm text-slate-300 sm:text-base">
          We do <strong>not</strong> publish the exact formulas or weights, but the qualitative meaning is:
        </p>

        <div className="space-y-6">
          <div className="space-y-2 rounded-2xl border border-slate-800 bg-background/50 p-5">
            <h3 className="text-xl font-semibold text-slate-100">3.1 Performance</h3>
            <p className="text-sm text-slate-300 sm:text-base">“How strong is this model when you actually use it?”</p>
            <p className="text-sm text-slate-300 sm:text-base">Signals include, for example:</p>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
              <li>Public benchmark results (reasoning, coding, general LLM evals)</li>
              <li>Community leaderboards and head-to-head evals</li>
              <li>Signs of real-world capability (if and where they’re available)</li>
            </ul>
            <p className="text-sm text-slate-300 sm:text-base">Higher scores mean:</p>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
              <li>The model tends to solve more tasks correctly</li>
              <li>It behaves competitively against other current-generation models</li>
            </ul>
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-800 bg-background/50 p-5">
            <h3 className="text-xl font-semibold text-slate-100">3.2 Safety &amp; Reliability</h3>
            <p className="text-sm text-slate-300 sm:text-base">“Can you depend on this model not to break in bad ways?”</p>
            <p className="text-sm text-slate-300 sm:text-base">We look at things like:</p>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
              <li>Publicly documented safety measures</li>
              <li>Known incidents, recalls, or major regressions</li>
              <li>How vendors respond to issues and ship safety updates</li>
            </ul>
            <p className="text-sm text-slate-300 sm:text-base">A model moves downward in this pillar when:</p>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
              <li>Serious incidents are widely reported</li>
              <li>The vendor quietly removes or ships unstable versions</li>
              <li>There is clear evidence of poor handling of safety problems</li>
            </ul>
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-800 bg-background/50 p-5">
            <h3 className="text-xl font-semibold text-slate-100">3.3 Adoption &amp; Support</h3>
            <p className="text-sm text-slate-300 sm:text-base">“Is it realistic to use this model in a real project?”</p>
            <p className="text-sm text-slate-300 sm:text-base">Signals include:</p>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
              <li>Recent updates (how stale or fresh the model is)</li>
              <li>SDKs, documentation, and developer experience</li>
              <li>Reliability of status pages and infrastructure</li>
              <li>Signs that the model is part of an active product, not a dead branch</li>
            </ul>
            <p className="text-sm text-slate-300 sm:text-base">Higher Adoption &amp; Support means:</p>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
              <li>The model is being maintained</li>
              <li>It is not just a one-off research drop</li>
              <li>Developers have a reasonable chance of integrating and running it at scale</li>
            </ul>
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-800 bg-background/50 p-5">
            <h3 className="text-xl font-semibold text-slate-100">3.4 Openness &amp; Transparency</h3>
            <p className="text-sm text-slate-300 sm:text-base">“How much does the vendor actually tell you?”</p>
            <p className="text-sm text-slate-300 sm:text-base">
              We do <strong>not</strong> reward or punish models for being open-source vs closed-source. Instead, we focus on <strong>how clear and honest the documentation is</strong>:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
              <li>Is there a model card or equivalent?</li>
              <li>Is the training data at least described at a high level?</li>
              <li>Are limitations, biases, and known issues discussed?</li>
              <li>Are there public policies around data handling and usage?</li>
            </ul>
            <p className="text-sm text-slate-300 sm:text-base">Higher scores here mean:</p>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
              <li>You can know what you are getting into before betting on the model</li>
              <li>The vendor treats transparency as part of the product</li>
            </ul>
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-800 bg-background/50 p-5">
            <h3 className="text-xl font-semibold text-slate-100">3.5 Cost Efficiency</h3>
            <p className="text-sm text-slate-300 sm:text-base">“Does the price roughly match what the model can do?”</p>
            <p className="text-sm text-slate-300 sm:text-base">We combine:</p>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
              <li>Token prices (input and output)</li>
              <li>Very rough performance tiers</li>
              <li>The idea that <strong>“same strength but cheaper” is usually better</strong></li>
            </ul>
            <p className="text-sm text-slate-300 sm:text-base">
              We do not try to predict your exact bill. Instead, we give a <strong>relative sense of how expensive a given level of capability is</strong>.
            </p>
            <p className="text-sm text-slate-300 sm:text-base">Cheap but extremely weak models will not automatically rank high here.</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-50">4. Where does the data come from?</h2>
        <p className="text-sm text-slate-300 sm:text-base">AMS v4 uses only <strong>publicly available information</strong>, such as:</p>
        <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
          <li>Official documentation and pricing pages</li>
          <li>Public benchmark dashboards and eval suites</li>
          <li>Vendor blog posts and changelogs</li>
          <li>Publicly reported incidents and withdrawals</li>
          <li>Widely cited community resources</li>
        </ul>
        <p className="text-sm text-slate-300 sm:text-base">
          We intentionally <strong>do not crawl private or scraped datasets</strong>.
        </p>
        <p className="text-sm text-slate-300 sm:text-base">
          When there is a conflict between sources, the engine errs on the side of being conservative (e.g. Provisional instead of Full).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-50">5. How often are scores updated?</h2>
        <p className="text-sm text-slate-300 sm:text-base">At the moment, updates are <strong>manual snapshots</strong>, not live streaming:</p>
        <ol className="list-decimal space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
          <li>The private engine is run offline</li>
          <li>It reads the latest public data and internal bootstrap lists</li>
          <li>It writes static JSON files (the “snapshot”)</li>
          <li>The snapshot is copied into the public repository and deployed</li>
        </ol>
        <p className="text-sm text-slate-300 sm:text-base">This means:</p>
        <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
          <li>Scores are <strong>not</strong> real-time</li>
          <li>A model may have improved (or regressed) since the last snapshot</li>
          <li>
            The <code className="rounded bg-slate-900/60 px-1 py-0.5">Updated</code> timestamp on the site reflects when the snapshot was taken, not when each individual data point changed
          </li>
        </ul>
        <p className="text-sm text-slate-300 sm:text-base">
          In the future, this process may be automated via scheduled jobs, but only after the methodology is stable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-50">6. What the scores are – and are not</h2>
        <p className="text-sm text-slate-300 sm:text-base">The AMS v4 scores are:</p>
        <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
          <li>A <strong>compressed summary</strong> of multiple public signals</li>
          <li>Opinionated by design (we chose what to care about and what to ignore)</li>
          <li>Useful for getting a <strong>rough sense</strong> of the model landscape</li>
        </ul>
        <p className="text-sm text-slate-300 sm:text-base">The scores are <strong>not</strong>:</p>
        <ul className="list-disc space-y-2 pl-6 text-sm text-slate-300 sm:text-base">
          <li>A guarantee that one model is “objectively best” for every use case</li>
          <li>A replacement for your own evaluations</li>
          <li>A ranking based on hype cycles, social media volume, or marketing</li>
        </ul>
        <p className="text-sm text-slate-300 sm:text-base">
          You should think of this site as:
        </p>
        <blockquote className="rounded-xl border border-slate-800 bg-background/60 px-4 py-3 text-sm text-slate-200 sm:text-base">
          “One carefully designed scoreboard, focused on a few specific criteria” rather than “the final word on all LLMs”.
        </blockquote>
      </section>
    </div>
  );
}
