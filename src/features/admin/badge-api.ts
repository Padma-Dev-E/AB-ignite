import { apiFetch } from "../../lib/api/client";

export const BADGE_PAGE_SIZE = 10;
export const adminBadgeQueryKey = ["admin", "badge-rules"] as const;

export type AdminBadge = {
  id: number;
  code: string;
  name: string;
  description: string;
  ruleJson: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BadgeEvent = { code: string; name: string; active: boolean };
export type AdminBadgePage = { items: AdminBadge[]; nextAfter: number | null; availableEvents: BadgeEvent[] };
export type BadgeRuleChange = {
  code: string;
  name: string;
  description: string;
  eventTypes: string[];
  minimumCount: number;
  active: boolean;
  reason: string;
};

export function adminBadgePageUrl(after: number | null) {
  const params = new URLSearchParams({ limit: String(BADGE_PAGE_SIZE) });
  if (after !== null) params.set("after", String(after));
  return `/api/admin/badges?${params.toString()}`;
}

export async function getAdminBadgeRules(after: number | null): Promise<AdminBadgePage> {
  return apiFetch<AdminBadgePage>(adminBadgePageUrl(after));
}

export async function saveAdminBadgeRule(id: number | null, input: BadgeRuleChange, idempotencyKey: string): Promise<AdminBadge> {
  return apiFetch<AdminBadge>(id === null ? "/api/admin/badges" : `/api/admin/badges/${id}`, {
    method: id === null ? "POST" : "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
}
