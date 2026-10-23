import { apiFetch } from "../../lib/api/client";

export type AdminAnnouncement = { id: number; title: string; body: string; pinned: boolean; published: boolean; createdAt?: string };
export type AdminCampaign = { id: number; title: string; description: string | null; active: boolean; pinned: boolean; endsAt: string | null; createdAt?: string };
export type ManagedChallenge = { id: number; title: string; question: string; deadlineAt: string; active: boolean; points: number };
export type EngagementCommand =
  | { kind: "announcement-create"; title: string; body: string }
  | { kind: "announcement-pin"; id: number; pinned: boolean }
  | { kind: "campaign-status"; id: number; active: boolean }
  | { kind: "challenge-create"; title: string; question: string; deadlineAt: string; active: boolean }
  | { kind: "challenge-close"; id: number };
export const adminEngagementKeys = {
  all: ["admin", "engagement"] as const,
  announcements: ["admin", "engagement", "announcements"] as const,
  campaigns: ["admin", "engagement", "campaigns"] as const,
  challenges: ["admin", "engagement", "challenges"] as const,
};
export type EngagementPage<T> = { items: T[]; nextAfter: number | null; total?: number };
export type EngagementNumberedPage<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };
function pageUrl(path: string, after: number | null) {
  const params = new URLSearchParams({ limit: "10" });
  if (after !== null) params.set("after", String(after));
  return `${path}?${params}`;
}
function numberedPageUrl(path: string, page: number) {
  return `${path}?${new URLSearchParams({ page: String(Math.max(1, Math.floor(page))), pageSize: "10" })}`;
}
export const listAdminAnnouncements = (page = 1) => apiFetch<EngagementNumberedPage<AdminAnnouncement>>(numberedPageUrl("/api/admin/engagement/announcements", page));
export const listAdminCampaigns = (page = 1) => apiFetch<EngagementNumberedPage<AdminCampaign>>(numberedPageUrl("/api/admin/engagement/campaigns", page));
export const listManagedChallenges = (after: number | null = null) => apiFetch<EngagementPage<ManagedChallenge>>(pageUrl("/api/admin/learning/challenges", after));
export function executeEngagementCommand({ command, reason, idempotencyKey }: { command: EngagementCommand; reason: string; idempotencyKey: string }) {
  let path: string;
  let method = "PATCH";
  let input: Record<string, unknown>;
  switch (command.kind) {
    case "announcement-create": path = "/api/admin/engagement/announcements"; method = "POST"; input = { title: command.title, body: command.body }; break;
    case "announcement-pin": path = `/api/admin/engagement/announcements/${command.id}`; input = { pinned: command.pinned }; break;
    case "campaign-status": path = "/api/admin/engagement/campaigns"; input = { campaignId: command.id, active: command.active }; break;
    case "challenge-create": path = "/api/admin/learning/challenges"; method = "POST"; input = { title: command.title, question: command.question, deadlineAt: command.deadlineAt, active: command.active }; break;
    case "challenge-close": path = `/api/admin/learning/challenges/${command.id}`; input = { active: false }; break;
  }
  return apiFetch<{ id: number }>(path, { method, headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ ...input, reason }) });
}
