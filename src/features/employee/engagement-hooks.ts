"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  engagementQueryKeys,
  getFeedbackCampaign,
  getNotifications,
  submitFeedback,
  updateNotificationRead,
} from "./engagement-api";
import type { FeedbackCategory, NotificationListResponse } from "./engagement-api";

export function nextNotificationPage(lastPage: NotificationListResponse): { page: number; cursor: string } | undefined {
  return lastPage.nextCursor ? { page: lastPage.page + 1, cursor: lastPage.nextCursor } : undefined;
}

export function useFeedbackCampaign() {
  return useQuery({
    queryKey: engagementQueryKeys.feedback,
    queryFn: getFeedbackCampaign,
  });
}

export function useSubmitEmployeeFeedback() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      category: FeedbackCategory;
      message: string;
      idempotencyKey: string;
    }) => submitFeedback(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: engagementQueryKeys.feedback });
    },
  });
}

export function useEmployeeNotifications(enabled = true) {
  const session = useSession();
  const userId = session.data?.user?.id ?? null;
  const query = useInfiniteQuery({
    queryKey: [...engagementQueryKeys.notifications, userId ?? "anonymous"],
    queryFn: ({ pageParam }) => getNotifications(pageParam.page, 20, pageParam.cursor),
    initialPageParam: { page: 1, cursor: undefined as string | undefined },
    getNextPageParam: nextNotificationPage,
    enabled: enabled && session.status !== "loading" && Boolean(userId),
    refetchInterval: enabled ? 30_000 : false,
  });
  const pages = query.data?.pages ?? [];
  const lastPage = pages.at(-1);
  return {
    ...query,
    data: lastPage
      ? {
          ...lastPage,
          items: pages.flatMap((page) => page.items),
        }
      : undefined,
  };
}

export function useSetEmployeeNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationRead,
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: engagementQueryKeys.notifications,
      });
    },
  });
}
