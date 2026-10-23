"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRedemptions, getRewards, requestRedemption } from "./api";

export const rewardsQueryKeys = {
  all: ["rewards"] as const,
  summary: () => ["rewards", "summary"] as const,
  redemptions: (params: { page?: number; pageSize?: number } = {}) => ["rewards", "redemptions", params] as const,
};

export function useRewards() { return useQuery({ queryKey: rewardsQueryKeys.summary(), queryFn: getRewards }); }
export function useRedemptions(params: { page?: number; pageSize?: number } = {}) { return useQuery({ queryKey: rewardsQueryKeys.redemptions(params), queryFn: () => getRedemptions(params) }); }
function newRedemptionKey(rewardId: number) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `reward-redemption:${rewardId}:${random}`;
}
export function useRequestRedemption() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ rewardId, idempotencyKey = newRedemptionKey(rewardId) }: { rewardId: number; idempotencyKey?: string }) => requestRedemption(rewardId, idempotencyKey),
    onSuccess: () => { void client.invalidateQueries({ queryKey: rewardsQueryKeys.all }); },
  });
}
