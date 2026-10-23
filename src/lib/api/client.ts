import type { ApiEnvelope } from "./contracts";

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number, public readonly requestId?: string) {
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
  return typeof error.code === "string" && typeof error.message === "string";
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
    throw new ApiError(body.error.code, body.error.message, response.status, body.requestId);
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
  const response = await fetch(input, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers,
  });
  return parseApiResponse<T>(response);
}
