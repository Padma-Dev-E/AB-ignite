"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  createAdminReward,
  getAdminRewardCatalogue,
  getRewards,
  updateAdminReward,
  type AdminRewardInput,
} from "./api";

export const rewardsQueryKeys = {
  all: ["rewards"] as const,
  summary: () => ["rewards", "summary"] as const,
  adminCatalogue: () => ["rewards", "admin", "catalogue"] as const,
};

export function refreshEmployeeRewards(client: QueryClient) {
  return client.invalidateQueries({ queryKey: rewardsQueryKeys.summary() });
}

export function useRewards(enabled = true) {
  return useQuery({
    queryKey: rewardsQueryKeys.summary(),
    queryFn: getRewards,
    enabled,
  });
}
export function useAdminRewardCatalogue(enabled = true) {
  return useQuery({
    queryKey: rewardsQueryKeys.adminCatalogue(),
    queryFn: getAdminRewardCatalogue,
    enabled,
  });
}

export function useSaveAdminReward() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: AdminRewardInput }) =>
      id === undefined
        ? createAdminReward(input)
        : updateAdminReward(id, input),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({
          queryKey: rewardsQueryKeys.adminCatalogue(),
        }),
        client.invalidateQueries({ queryKey: rewardsQueryKeys.all }),
      ]),
  });
}
