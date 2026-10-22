import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AiIdempotencyError, AiPolicyError, AiProviderError, AiSchemaValidationError, AiTimeoutError } from "../ai/errors";

export type ApiEnvelope<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
  requestId: string;
};

export function requestId(request?: Request): string {
  const supplied = request?.headers.get("x-request-id")?.trim();
  return supplied && /^[a-zA-Z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
}

function response<T>(body: ApiEnvelope<T>, status: number) {
  return NextResponse.json(body, { status, headers: { "x-request-id": body.requestId, "cache-control": "no-store" } });
}

export function ok<T>(data: T, status = 200, id: string = randomUUID()) {
  return response({ data, error: null, requestId: id }, status);
}

export function apiError(code: string, message: string, status: number, id: string = randomUUID()) {
  return response({ data: null, error: { code, message }, requestId: id }, status);
}

export function handleApiError(error: unknown, id: string = randomUUID()) {
  if (error instanceof z.ZodError || error instanceof AiSchemaValidationError) return apiError("validation_error", "The request could not be validated.", 400, id);
  if (error instanceof AiPolicyError) return apiError("policy_blocked", "This request requires human review.", 422, id);
  if (error instanceof AiIdempotencyError) return apiError("conflict", "This request is already being processed.", 409, id);
  if (error instanceof AiProviderError || error instanceof AiTimeoutError) return apiError("provider_unavailable", "The AI service is temporarily unavailable.", 502, id);
  return apiError("internal_error", "An unexpected server error occurred.", 500, id);
}
