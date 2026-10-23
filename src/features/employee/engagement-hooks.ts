"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { engagementQueryKeys, getFeedbackCampaign, getNotifications, submitFeedback, updateNotificationRead } from "./engagement-api";
import type { FeedbackCategory } from "./engagement-api";

export function useFeedbackCampaign() {
  return useQuery({ queryKey: engagementQueryKeys.feedback, queryFn: getFeedbackCampaign });
}

export function useSubmitEmployeeFeedback() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { category: FeedbackCategory; message: string; idempotencyKey: string }) => submitFeedback(input),
    onSuccess: () => { void client.invalidateQueries({ queryKey: engagementQueryKeys.feedback }); },
  });
}

export function useEmployeeNotifications(enabled = true) {
  return useQuery({ queryKey: engagementQueryKeys.notifications, queryFn: getNotifications, enabled, refetchInterval: enabled ? 30_000 : false });
}

export function useSetEmployeeNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationRead,
    onSuccess: () => { void client.invalidateQueries({ queryKey: engagementQueryKeys.notifications }); },
  });
}
