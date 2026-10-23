import { apiFetch } from "../../lib/api/client";
import type { AdminAuditEvent, AdminChallenge, AdminEvaluationDetail, AdminFeedbackResponse, AdminIdea, AdminQuiz, AdminRedemption, AdminReward, AdminSettings, AdminUser, Paginated } from "./types";

type ListResponse<T> = { items: T[] };

export function listAdminQuizCatalogue() {
  return apiFetch<ListResponse<AdminQuiz>>("/api/quizzes");
}

export function listAdminChallenges() {
  return apiFetch<ListResponse<AdminChallenge>>("/api/challenges");
}

export async function listAdminRewards() {
  const response = await apiFetch<AdminReward[] | ListResponse<AdminReward>>("/api/admin/rewards");
  return Array.isArray(response) ? response : response.items;
}
export type AdminRewardInput = Pick<AdminReward, "name" | "description" | "kind" | "cost" | "emoji" | "active"> & { reason: string };
export function createAdminReward(input: AdminRewardInput) {
  return apiFetch<{ reward: AdminReward; version: unknown }>("/api/admin/rewards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
}
export function updateAdminReward(id: number, input: AdminRewardInput) {
  return apiFetch<{ reward: AdminReward; version: unknown }>(`/api/admin/rewards/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
}

export function listAdminRedemptions() {
  return apiFetch<Paginated<AdminRedemption>>("/api/admin/rewards/redemptions");
}
export function listAdminUsers() { return apiFetch<{ items: AdminUser[]; nextAfter: number | null }>("/api/admin/users?limit=50"); }
export function listAdminAudit() { return apiFetch<{ items: AdminAuditEvent[]; nextAfter: number | null }>("/api/admin/audit?limit=50"); }
export function listAdminScreening() { return apiFetch<{ items: AdminIdea[]; nextAfter: number | null }>("/api/admin/governance/queues/screening?limit=50"); }
export function listAdminTransformation() { return apiFetch<{ items: AdminIdea[]; nextAfter: number | null }>("/api/admin/governance/queues/transformation?limit=50"); }
export function getAdminSettings() { return apiFetch<AdminSettings>("/api/admin/settings"); }
export function listAdminRoutedEvaluations() { return apiFetch<{ items: AdminIdea[]; nextAfter: number | null }>("/api/admin/governance/evaluations?limit=100"); }
export function getAdminEvaluation(ideaId: number) { return apiFetch<AdminEvaluationDetail>(`/api/admin/governance/evaluations/${ideaId}`); }
export function listAdminFeedback() { return apiFetch<{ items: AdminFeedbackResponse[] }>("/api/admin/feedback"); }
export function respondToAdminFeedback(id: number, response: string) {
  return apiFetch<{ id: number; respondedAt: string }>(`/api/admin/feedback/${id}/respond`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ response }) });
}

export type GovernanceAction = "route" | "return" | "reject" | "defer" | "approve" | "not_recommended" | "confirm";
export function decideAdminIdea(ideaId: number, action: GovernanceAction, reason: string, businessOwnerId?: number) {
  return apiFetch(`/api/admin/governance/ideas/${ideaId}/decision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason, businessOwnerId }) });
}
export type EvaluationAction = "approve" | "return" | "not_recommended";
export function decideAdminEvaluation(ideaId: number, action: EvaluationAction, reason: string) {
  return decideAdminIdea(ideaId, action, reason);
}
export type RedemptionAction = "fulfill" | "cancel";
export function actOnAdminRedemption(id: number, action: RedemptionAction, reason: string) {
  return apiFetch(`/api/admin/rewards/redemptions/${id}/${action}`, { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ reason }) });
}

export const adminQueryKeys = {
  all: ["admin"] as const,
  quizzes: ["admin", "quizzes"] as const,
  challenges: ["admin", "challenges"] as const,
  rewards: ["admin", "rewards"] as const,
  redemptions: ["admin", "rewards", "redemptions"] as const,
  users: ["admin", "users"] as const,
  audit: ["admin", "audit"] as const,
  screening: ["admin", "governance", "screening"] as const,
  transformation: ["admin", "governance", "transformation"] as const,
  settings: ["admin", "settings"] as const,
  evaluations: ["admin", "governance", "evaluations"] as const,
  evaluation: (ideaId: number) => ["admin", "governance", "evaluations", ideaId] as const,
  feedback: ["admin", "feedback"] as const,
};
