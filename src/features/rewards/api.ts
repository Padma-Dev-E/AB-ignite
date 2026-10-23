import { apiFetch } from "../../lib/api/client";
import type { AdminReward, AdminRewardWriteResult, EmployeeRewards, RedemptionPage, RedemptionResult } from "./types";

function queryString(params: { page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.pageSize !== undefined) query.set("pageSize", String(params.pageSize));
  const result = query.toString();
  return result ? `?${result}` : "";
}

export function getRewards() { return apiFetch<EmployeeRewards>("/api/rewards"); }
export function getRedemptions(params: { page?: number; pageSize?: number } = {}) { return apiFetch<RedemptionPage>(`/api/rewards/redemptions${queryString(params)}`); }
export function requestRedemption(rewardId: number, idempotencyKey: string) {
  return apiFetch<RedemptionResult>("/api/rewards/redemptions", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify({ rewardId, idempotencyKey }) });
}

export function getAdminRewardCatalogue() {
  return apiFetch<AdminReward[] | { items: AdminReward[] }>("/api/admin/rewards").then((result) => Array.isArray(result) ? result : result.items);
}

export type AdminRewardInput = Omit<AdminReward, "id" | "createdAt" | "updatedAt"> & { reason: string };

export function createAdminReward(input: AdminRewardInput) {
  return apiFetch<AdminRewardWriteResult>("/api/admin/rewards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
}

export function updateAdminReward(id: number, input: AdminRewardInput) {
  return apiFetch<AdminRewardWriteResult>(`/api/admin/rewards/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
}
