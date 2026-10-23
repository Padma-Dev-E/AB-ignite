"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getPointsSummary } from "./api";

export const pointsQueryKeys = {
  summary: ["points", "summary"] as const,
};

export function refreshPointsSummary(client: QueryClient) {
  return client.invalidateQueries({ queryKey: pointsQueryKeys.summary });
}

export function usePointsSummary(enabled = true) {
  return useQuery({ queryKey: pointsQueryKeys.summary, queryFn: getPointsSummary, enabled });
}
