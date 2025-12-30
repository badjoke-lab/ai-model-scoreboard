import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyModelRoute({ params }: { params: { slug: string } }) {
  redirect(`/models/${encodeURIComponent(params.slug)}`);
}
