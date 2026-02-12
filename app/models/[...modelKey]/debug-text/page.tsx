import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getModelDetailPayload } from "@/lib/v4/model-detail-api";
import { applyAlias, fromRouteParam, toEncodedModelKey } from "@/lib/v4/modelKey";
import { renderModelDetailText } from "@/lib/v4/render-detail-text";

export default async function ModelDebugTextPage({
  params,
}: {
  params: { modelKey: string[] };
}) {
  const rawParam = Array.isArray(params.modelKey)
    ? params.modelKey.join("/")
    : params.modelKey;
  const routeModelKey = fromRouteParam(rawParam ?? "");
  const aliasResult = applyAlias(routeModelKey);

  if (aliasResult.loop) {
    notFound();
  }

  const modelKey = aliasResult.key;

  if (modelKey && modelKey !== routeModelKey) {
    redirect(`/models/${toEncodedModelKey(modelKey)}/debug-text`);
  }

  const detail = await getModelDetailPayload(modelKey);
  if (!detail) {
    notFound();
  }

  const text = renderModelDetailText(detail);

  return (
    <main className="space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Model Debug Text</p>
        <h1 className="text-xl font-semibold text-slate-100">{modelKey}</h1>
      </header>
      <div className="flex gap-4 text-sm">
        <Link className="text-accent underline" href={`/models/${toEncodedModelKey(modelKey)}`}>
          View model page
        </Link>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-200">
        {text}
      </pre>
    </main>
  );
}
