type AnyObj = Record<string, unknown>;

export function isHttpUrl(x: unknown): x is string {
  if (typeof x !== "string") return false;
  const s = x.trim();
  return s.startsWith("http://") || s.startsWith("https://");
}

function pickFirstHttpFromArray(x: unknown): string | null {
  if (!Array.isArray(x)) return null;
  for (const v of x) {
    if (isHttpUrl(v)) return v.trim();
  }
  return null;
}

export function pickUrl(x: unknown): string | null {
  if (!x || typeof x !== "object") return null;
  const o = x as AnyObj;

  for (const k of ["url", "link", "href"] as const) {
    if (isHttpUrl(o[k])) return (o[k] as string).trim();
  }

  const refs = pickFirstHttpFromArray(o.refs);
  if (refs) return refs;

  const extracted = o.extracted;
  if (extracted && typeof extracted === "object") {
    const ex = extracted as AnyObj;
    for (const k of ["url", "link", "href"] as const) {
      if (isHttpUrl(ex[k])) return (ex[k] as string).trim();
    }
  }

  const urls = pickFirstHttpFromArray(o.urls);
  if (urls) return urls;

  return null;
}

export function pickUrls(x: unknown): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (isHttpUrl(v)) out.push(v.trim());
  };

  if (!x || typeof x !== "object") return out;
  const o = x as AnyObj;

  for (const k of ["url", "link", "href"] as const) push(o[k]);
  if (Array.isArray(o.refs)) for (const v of o.refs as unknown[]) push(v);

  const extracted = o.extracted;
  if (extracted && typeof extracted === "object") {
    const ex = extracted as AnyObj;
    for (const k of ["url", "link", "href"] as const) push(ex[k]);
  }

  if (Array.isArray(o.urls)) for (const v of o.urls as unknown[]) push(v);

  return Array.from(new Set(out));
}
