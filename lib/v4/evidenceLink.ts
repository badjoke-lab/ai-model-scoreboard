export function pickEvidenceUrl(e: any): string | null {
  const refs = e?.refs;
  if (Array.isArray(refs) && typeof refs[0] === "string" && refs[0]) return refs[0];

  const ex = e?.extracted?.url;
  if (typeof ex === "string" && ex) return ex;

  const link = e?.link;
  if (typeof link === "string" && link) return link;

  const url = e?.url;
  if (typeof url === "string" && url) return url;

  return null;
}
