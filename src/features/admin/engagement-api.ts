import { apiFetch } from "../../lib/api/client";

export type AdminAnnouncement = { id: number; title: string; body: string; pinned: boolean; published: boolean };
export type AdminCampaign = { id: number; title: string; description: string | null; active: boolean; pinned: boolean; endsAt: string | null };
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
export const listAdminAnnouncements = () => apiFetch<{ items: AdminAnnouncement[] }>("/api/admin/engagement/announcements?limit=100");
export const listAdminCampaigns = () => apiFetch<{ items: AdminCampaign[] }>("/api/admin/engagement/campaigns?limit=100");
export const listManagedChallenges = () => apiFetch<ManagedChallenge[]>("/api/admin/learning/challenges");
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
