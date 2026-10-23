import { apiFetch } from "../../lib/api/client";
import type { AdminFeedbackResponse, AdminIdea } from "./types";

export type CursorPage<T> = { items: T[]; nextAfter: number | null; total?: number };

function cursorUrl(path: string, after: number | null) {
  const params = new URLSearchParams({ limit: "10" });
  if (after !== null) params.set("after", String(after));
  return `${path}?${params}`;
}

export const listAdminFeedbackPage = (after: number | null) =>
  apiFetch<CursorPage<AdminFeedbackResponse>>(cursorUrl("/api/admin/feedback", after));

export const listAdminEvaluationPage = (after: number | null) =>
  apiFetch<CursorPage<AdminIdea>>(cursorUrl("/api/admin/governance/evaluations", after));
