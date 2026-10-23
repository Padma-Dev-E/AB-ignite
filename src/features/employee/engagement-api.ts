import { apiFetch } from "../../lib/api/client";

export type FeedbackCategory =
  "experience" | "ideas" | "content" | "technical" | "other";
export type FeedbackCampaign = {
  id: number;
  title: string;
  description: string | null;
};
export type FeedbackResponse = {
  id: number;
  campaignId: number;
  category: FeedbackCategory;
  message: string;
  createdAt: string;
};
export type FeedbackCampaignResponse = {
  campaign: FeedbackCampaign | null;
  responses: FeedbackResponse[];
};
export type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  target: {
    type: "idea" | "announcement" | "feedback" | "learning" | "none";
    id: number | null;
    path: string | null;
    available: boolean;
  };
  isRead: boolean;
  createdAt: string;
};
export type NotificationListResponse = {
  items: Notification[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unreadCount: number;
  nextCursor: string | null;
};

export type NotificationAnnouncement = {
  id: number;
  title: string;
  body: string;
  publishedAt: string;
};

export function getFeedbackCampaign() {
  return apiFetch<FeedbackCampaignResponse>("/api/feedback");
}
export function submitFeedback(input: {
  category: FeedbackCategory;
  message: string;
  idempotencyKey: string;
}) {
  return apiFetch<FeedbackResponse>("/api/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": input.idempotencyKey,
    },
    body: JSON.stringify(input),
  });
}
export function getNotifications(page = 1, pageSize = 20, cursor?: string) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (cursor) query.set("cursor", cursor);
  return apiFetch<NotificationListResponse>(
    `/api/notifications?${query}`,
  );
}

export function getNotificationAnnouncement(id: number) {
  return apiFetch<NotificationAnnouncement>(`/api/announcements/${id}`);
}
export function updateNotificationRead(input: {
  id?: number;
  all?: boolean;
  read: boolean;
}) {
  return apiFetch<{ updated: boolean }>("/api/notifications", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export const engagementQueryKeys = {
  feedback: ["employee", "feedback"] as const,
  notifications: ["employee", "notifications"] as const,
};
