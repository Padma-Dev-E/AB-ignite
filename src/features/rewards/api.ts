import { apiFetch } from "../../lib/api/client";
import type { AdminReward, AdminRewardWriteResult, EmployeeRewards } from "./types";

export function getRewards() { return apiFetch<EmployeeRewards>("/api/rewards"); }

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
