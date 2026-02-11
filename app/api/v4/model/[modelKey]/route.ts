import { NextResponse } from "next/server";

import {
  enforceModelDetailEvidenceIntegrity,
  getModelDetailPayload,
} from "@/lib/v4/model-detail-api";
import { fromRouteParam } from "@/lib/v4/modelKey";

type RouteParams = {
  params: {
    modelKey: string | string[];
  };
};

export async function GET(_request: Request, { params }: RouteParams) {
  const rawModelKey = params.modelKey;
  const routeParam = (Array.isArray(rawModelKey) ? rawModelKey : [rawModelKey]).join("/");
  const modelKey = fromRouteParam(routeParam);

  if (!modelKey) {
    return NextResponse.json(
      { ok: false, error: { code: "missing_model_key", message: "Missing modelKey." } },
      { status: 400 }
    );
  }

  const payload = await getModelDetailPayload(modelKey);
  if (!payload) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "model_not_found", message: `Model not found: ${modelKey}` },
      },
      { status: 404 }
    );
  }

  try {
    const validatedPayload = enforceModelDetailEvidenceIntegrity(payload);
    return NextResponse.json(validatedPayload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to validate model detail payload.";
    return NextResponse.json(
      { ok: false, error: { code: "validation_error", message } },
      { status: 500 }
    );
  }
}
