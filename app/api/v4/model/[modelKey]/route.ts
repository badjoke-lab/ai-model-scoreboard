import { NextResponse } from "next/server";

import { getModelDetailPayload } from "@/lib/v4/model-detail-api";

type RouteParams = {
  params: {
    modelKey: string[];
  };
};

export async function GET(_request: Request, { params }: RouteParams) {
  const segments = (params.modelKey ?? []).map((segment) => decodeURIComponent(segment));
  const modelKey = segments.join("/");

  if (!modelKey) {
    return NextResponse.json(
      { status: "error", error: "Missing modelKey." },
      { status: 400 }
    );
  }

  const payload = await getModelDetailPayload(modelKey);
  if (!payload) {
    return NextResponse.json(
      { status: "error", error: `Model not found: ${modelKey}` },
      { status: 404 }
    );
  }

  return NextResponse.json(payload);
}
