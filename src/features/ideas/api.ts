import { apiFetch } from "../../lib/api/client";
import type { CommentListResponse, Idea, IdeaComment, IdeaCreateInput, IdeaCreateResponse, IdeaDetailResponse, IdeaListParams, IdeaListResponse, IdeaSubmissionInput, IdeaSubmitResponse, IdeaUpdateInput, SupportResponse } from "./types";

function queryString(params: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value));
  const result = query.toString();
  return result ? `?${result}` : "";
}

export function listIdeas(params: IdeaListParams = {}) { return apiFetch<IdeaListResponse>(`/api/ideas${queryString(params)}`); }
export function createIdea(input: IdeaCreateInput) { return apiFetch<IdeaCreateResponse>("/api/ideas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }); }
export function submitIdea(id: number, versionId?: number) { return apiFetch<IdeaSubmitResponse>(`/api/ideas/${id}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ versionId, idempotencyKey: `idea:${id}:submit:${versionId ?? "latest"}` }) }); }
export function saveIdeaSubmission(id: number, input: IdeaSubmissionInput) { return apiFetch<{ score: number; minimumScore: number; answers: IdeaSubmissionInput["answers"]; metrics: IdeaSubmissionInput["metrics"] }>(`/api/ideas/${id}/submission`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }); }
export function getIdea(id: number, params: { page?: number; pageSize?: number } = {}) { return apiFetch<IdeaDetailResponse>(`/api/ideas/${id}${queryString(params)}`); }
export function updateIdea(id: number, input: IdeaUpdateInput) { return apiFetch<{ idea: Idea; version: unknown }>(`/api/ideas/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }); }
export function listIdeaComments(id: number, params: { page?: number; pageSize?: number } = {}) { return apiFetch<CommentListResponse>(`/api/ideas/${id}/comments${queryString(params)}`); }
export function addIdeaComment(id: number, body: string) { return apiFetch<IdeaComment>(`/api/ideas/${id}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) }); }
export function supportIdea(id: number) { return apiFetch<SupportResponse>(`/api/ideas/${id}/support`, { method: "POST" }); }

export const ideaQueryKeys = {
  all: ["ideas"] as const,
  list: (params: IdeaListParams) => ["ideas", "list", params] as const,
  detail: (id: number) => ["ideas", "detail", id] as const,
  comments: (id: number, params: { page?: number; pageSize?: number }) => ["ideas", id, "comments", params] as const,
};
