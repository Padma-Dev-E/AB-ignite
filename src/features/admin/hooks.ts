"use client";

import { useQuery } from "@tanstack/react-query";
import { adminQueryKeys, getAdminSettings, listAdminAudit, listAdminChallenges, listAdminQuizCatalogue, listAdminRedemptions, listAdminRewards, listAdminScreening, listAdminTransformation, listAdminUsers } from "./api";

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
export function useAdminScreening(enabled = true) { return useQuery({ queryKey: adminQueryKeys.screening, queryFn: listAdminScreening, enabled }); }
export function useAdminTransformation(enabled = true) { return useQuery({ queryKey: adminQueryKeys.transformation, queryFn: listAdminTransformation, enabled }); }
export function useAdminSettings(enabled = true) { return useQuery({ queryKey: adminQueryKeys.settings, queryFn: getAdminSettings, enabled }); }
