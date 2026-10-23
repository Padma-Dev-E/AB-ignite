"use client";

import { useQuery } from "@tanstack/react-query";
import { adminQueryKeys, listAdminAudit, listAdminChallenges, listAdminQuizCatalogue, listAdminRedemptions, listAdminRewards, listAdminUsers } from "./api";

export function useAdminQuizCatalogue(enabled = true) {
  return useQuery({ queryKey: adminQueryKeys.quizzes, queryFn: listAdminQuizCatalogue, enabled });
}

export function useAdminChallenges(enabled = true) {
  return useQuery({ queryKey: adminQueryKeys.challenges, queryFn: listAdminChallenges, enabled });
}

export function useAdminRewards(enabled = true) {
  return useQuery({ queryKey: adminQueryKeys.rewards, queryFn: listAdminRewards, enabled });
}

export function useAdminRedemptions(enabled = true) {
  return useQuery({ queryKey: adminQueryKeys.redemptions, queryFn: listAdminRedemptions, enabled });
}
export function useAdminUsers(enabled = true) { return useQuery({ queryKey: adminQueryKeys.users, queryFn: listAdminUsers, enabled }); }
export function useAdminAudit(enabled = true) { return useQuery({ queryKey: adminQueryKeys.audit, queryFn: listAdminAudit, enabled }); }
