"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actOnAdminRedemption, adminQueryKeys, decideAdminEvaluation, decideAdminIdea, getAdminEvaluation, getAdminSettings, listAdminAudit, listAdminChallenges, listAdminFeedback, listAdminQuizCatalogue, listAdminRedemptions, listAdminRewards, listAdminRoutedEvaluations, listAdminScreening, listAdminTransformation, listAdminUsers, respondToAdminFeedback, type EvaluationAction, type GovernanceAction, type RedemptionAction } from "./api";

export function useAdminGovernanceDecision() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ ideaId, action, reason, businessOwnerId }: { ideaId: number; action: GovernanceAction; reason: string; businessOwnerId?: number }) => decideAdminIdea(ideaId, action, reason, businessOwnerId), onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: adminQueryKeys.screening }), client.invalidateQueries({ queryKey: adminQueryKeys.transformation })]) });
}

export function useAdminRedemptionAction() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, action, reason }: { id: number; action: RedemptionAction; reason: string }) => actOnAdminRedemption(id, action, reason), onSuccess: () => client.invalidateQueries({ queryKey: adminQueryKeys.redemptions }) });
}

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
export function useAdminRoutedEvaluations(enabled = true) { return useQuery({ queryKey: adminQueryKeys.evaluations, queryFn: listAdminRoutedEvaluations, enabled }); }
export function useAdminEvaluation(ideaId: number | null) { return useQuery({ queryKey: ideaId ? adminQueryKeys.evaluation(ideaId) : [...adminQueryKeys.evaluations, "none"], queryFn: () => getAdminEvaluation(ideaId!), enabled: ideaId !== null }); }
export function useAdminEvaluationDecision() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ ideaId, action, reason }: { ideaId: number; action: EvaluationAction; reason: string }) => decideAdminEvaluation(ideaId, action, reason), onSuccess: (_data, variables) => Promise.all([client.invalidateQueries({ queryKey: adminQueryKeys.evaluations }), client.invalidateQueries({ queryKey: adminQueryKeys.evaluation(variables.ideaId) })]) });
}
export function useAdminFeedback(enabled = true) { return useQuery({ queryKey: adminQueryKeys.feedback, queryFn: listAdminFeedback, enabled }); }
export function useAdminFeedbackResponse() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, response }: { id: number; response: string }) => respondToAdminFeedback(id, response), onSuccess: () => client.invalidateQueries({ queryKey: adminQueryKeys.feedback }) });
}
