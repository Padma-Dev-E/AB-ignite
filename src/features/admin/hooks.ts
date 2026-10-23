"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminQueryKeys,
  createAdminReward,
  decideAdminEvaluation,
  decideAdminIdea,
  getAdminEvaluation,
  getAdminSettings,
  listAdminAudit,
  listAdminChallenges,
  listAdminFeedback,
  listAdminQuizCatalogue,
  listAdminRewards,
  listAdminRoutedEvaluations,
  listAdminScreening,
  listAdminTransformation,
  listAdminBusinessOwners,
  listAdminUsers,
  respondToAdminFeedback,
  updateAdminReward,
  type AdminRewardInput,
  type EvaluationAction,
  type GovernanceAction,
} from "./api";
import { getAdminAnalytics } from "./api";

export function useAdminGovernanceDecision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      ideaId,
      action,
      reason,
      businessOwnerId,
    }: {
      ideaId: number;
      action: GovernanceAction;
      reason: string;
      businessOwnerId?: number;
    }) => decideAdminIdea(ideaId, action, reason, businessOwnerId),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: adminQueryKeys.screening }),
        client.invalidateQueries({ queryKey: adminQueryKeys.transformation }),
      ]),
  });
}

export function useAdminQuizCatalogue(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.quizzes,
    queryFn: listAdminQuizCatalogue,
    enabled,
  });
}

export function useAdminChallenges(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.challenges,
    queryFn: listAdminChallenges,
    enabled,
  });
}

export function useAdminRewards(enabled = true) {
  return useQuery({ queryKey: adminQueryKeys.rewards, queryFn: listAdminRewards, enabled });
}
export function useCreateAdminReward() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: AdminRewardInput) => createAdminReward(input), onSuccess: () => client.invalidateQueries({ queryKey: adminQueryKeys.rewards }) });
}
export function useUpdateAdminReward() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: number; input: AdminRewardInput }) => updateAdminReward(id, input), onSuccess: () => client.invalidateQueries({ queryKey: adminQueryKeys.rewards }) });
}

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.users,
    queryFn: listAdminUsers,
    enabled,
  });
}
export function useAdminAudit(
  enabled = true,
  filters: Parameters<typeof listAdminAudit>[0] = {},
) {
  return useQuery({
    queryKey: adminQueryKeys.audit(filters),
    queryFn: () => listAdminAudit(filters),
    enabled,
  });
}
export function useAdminAnalytics(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.analytics,
    queryFn: getAdminAnalytics,
    enabled,
  });
}
export function useAdminScreening(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.screening,
    queryFn: () => listAdminScreening(),
    enabled,
  });
}
export function useAdminTransformation(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.transformation,
    queryFn: () => listAdminTransformation(),
    enabled,
  });
}
export function useAdminScreeningPages(enabled = true) {
  return useInfiniteQuery({
    queryKey: [...adminQueryKeys.screening, "pages", 10] as const,
    queryFn: ({ pageParam }) => listAdminScreening(10, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (page) => page.nextAfter ?? undefined,
    enabled,
  });
}
export function useAdminTransformationPages(enabled = true) {
  return useInfiniteQuery({
    queryKey: [...adminQueryKeys.transformation, "pages", 10] as const,
    queryFn: ({ pageParam }) => listAdminTransformation(10, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (page) => page.nextAfter ?? undefined,
    enabled,
  });
}
export function useAdminBusinessOwnerPages(enabled = true) {
  return useInfiniteQuery({
    queryKey: ["admin", "governance", "owners", 100] as const,
    queryFn: ({ pageParam }) => listAdminBusinessOwners(100, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (page) => page.nextAfter ?? undefined,
    enabled,
  });
}
export function useAdminSettings(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.settings,
    queryFn: getAdminSettings,
    enabled,
  });
}
export function useAdminRoutedEvaluations(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.evaluations,
    queryFn: listAdminRoutedEvaluations,
    enabled,
  });
}
export function useAdminEvaluation(ideaId: number | null) {
  return useQuery({
    queryKey: ideaId
      ? adminQueryKeys.evaluation(ideaId)
      : [...adminQueryKeys.evaluations, "none"],
    queryFn: () => getAdminEvaluation(ideaId!),
    enabled: ideaId !== null,
  });
}
export function useAdminEvaluationDecision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      ideaId,
      action,
      reason,
      controlName,
    }: {
      ideaId: number;
      action: EvaluationAction;
      reason: string;
      controlName?: string;
    }) => decideAdminEvaluation(ideaId, action, reason, controlName),
    onSuccess: (_data, variables) =>
      Promise.all([
        client.invalidateQueries({ queryKey: adminQueryKeys.evaluations }),
        client.invalidateQueries({
          queryKey: adminQueryKeys.evaluation(variables.ideaId),
        }),
      ]),
  });
}
export function useAdminFeedback(enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.feedback,
    queryFn: listAdminFeedback,
    enabled,
  });
}
export function useAdminFeedbackResponse() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response }: { id: number; response: string }) =>
      respondToAdminFeedback(id, response),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: adminQueryKeys.feedback }),
  });
}
