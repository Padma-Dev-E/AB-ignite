import { apiFetch } from "../../lib/api/client";
import type { AdminChallenge, AdminQuiz, AdminRedemption, AdminReward, Paginated } from "./types";

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

export function listAdminRedemptions() {
  return apiFetch<Paginated<AdminRedemption>>("/api/admin/rewards/redemptions");
}

export const adminQueryKeys = {
  all: ["admin"] as const,
  quizzes: ["admin", "quizzes"] as const,
  challenges: ["admin", "challenges"] as const,
  rewards: ["admin", "rewards"] as const,
  redemptions: ["admin", "rewards", "redemptions"] as const,
};
