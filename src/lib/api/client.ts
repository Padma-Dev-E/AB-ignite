import type { ApiEnvelope, PriorityRejectionDetails } from "./contracts";
import { activeSessionRefresh, refreshSession } from "../../auth/client-refresh";

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly requestId?: string, public readonly details?: PriorityRejectionDetails) {
    super(message);
    this.name = "ApiError";
  }
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  if (!("data" in body) || typeof body.requestId !== "string") return false;
  if (body.error === null) return true;
  if (body.data !== null || typeof body.error !== "object" || body.error === null) return false;
  const error = body.error as Record<string, unknown>;
  if (typeof error.code !== "string" || typeof error.message !== "string") return false;
  if (error.details === undefined) return true;
  if (typeof error.details !== "object" || error.details === null || Array.isArray(error.details)) return false;
  const details = error.details as Record<string, unknown>;
  if (!("score" in details) && !("minimumScore" in details) && !("priorityBand" in details) && !("breakdown" in details)) return false;
  if (details.score !== undefined && (typeof details.score !== "number" || !Number.isFinite(details.score))) return false;
  if (details.minimumScore !== undefined && (typeof details.minimumScore !== "number" || !Number.isFinite(details.minimumScore))) return false;
  if (details.priorityBand !== undefined && !["Watch", "Quality", "Priority"].includes(String(details.priorityBand))) return false;
  if (details.breakdown !== undefined) {
    if (!Array.isArray(details.breakdown) || details.breakdown.length !== 3) return false;
    const valid = details.breakdown.every((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
      const row = item as Record<string, unknown>;
      return ["turnaround", "volume", "value"].includes(String(row.key))
        && typeof row.question === "string" && row.question.length <= 500
        && typeof row.hint === "string" && row.hint.length <= 500
        && typeof row.score === "number" && Number.isFinite(row.score) && row.score >= 0 && row.score <= 3
        && typeof row.weight === "number" && Number.isFinite(row.weight) && row.weight >= 0 && row.weight <= 1
        && typeof row.contribution === "number" && Number.isFinite(row.contribution);
    });
    if (!valid) return false;
  }
  return true;
}

/** Unwrap the shared envelope, retaining correlation metadata on failures. */
export async function parseApiResponse<T>(response: Response): Promise<T> {
  const requestId = response.headers.get("x-request-id") ?? undefined;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("invalid_response", "The server returned an invalid response.", response.status, requestId);
  }
  if (!isEnvelope(body)) {
    throw new ApiError("invalid_response", "The server returned an invalid response.", response.status, requestId);
  }
  if (body.error) {
    throw new ApiError(body.error.code, body.error.message, response.status, body.requestId, body.error.details);
  }
  if (!response.ok) {
    throw new ApiError("http_error", "The request failed.", response.status, body.requestId);
  }
  return body.data as T;
}

/** Pass JSON-stringified bodies (and their content type) through RequestInit. */
export async function apiFetch<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  const request = () => fetch(input, { credentials: "same-origin", cache: "no-store", ...init, headers });
  const pendingRefresh = activeSessionRefresh();
  if (pendingRefresh) await pendingRefresh;
  let response = await request();
  if (response.status === 401 && input !== "/api/auth/refresh" && await refreshSession()) {
    response = await request();
  }
  return parseApiResponse<T>(response);
}
