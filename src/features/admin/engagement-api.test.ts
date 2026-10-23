import assert from "node:assert/strict";
import test from "node:test";
import { executeEngagementCommand, listAdminAnnouncements, listAdminCampaigns, listManagedChallenges, type EngagementCommand } from "./engagement-api";

test("engagement commands match secured route contracts and preserve retry keys", async () => {
  const original = globalThis.fetch;
  const requests: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init: RequestInit = {}) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ data: { id: 1 }, error: null, requestId: "engagement-test" }));
  }) as typeof fetch;
  try {
    await listAdminAnnouncements(); await listAdminCampaigns(); await listManagedChallenges();
    const commands: EngagementCommand[] = [
      { kind: "announcement-create", title: "News", body: "Update" },
      { kind: "announcement-pin", id: 4, pinned: true },
      { kind: "campaign-status", id: 5, active: false },
      { kind: "campaign-status", id: 5, active: true },
      { kind: "challenge-create", title: "Theme", question: "How?", deadlineAt: "2030-01-01T00:00:00.000Z", active: true },
      { kind: "challenge-close", id: 6 },
    ];
    for (const command of commands) await executeEngagementCommand({ command, reason: "Approved review", idempotencyKey: "stable-retry-key" });
    await executeEngagementCommand({ command: commands[0], reason: "Approved review", idempotencyKey: "stable-retry-key" });
    assert.deepEqual(requests.slice(0, 3).map(r => r.url), ["/api/admin/engagement/announcements?limit=100", "/api/admin/engagement/campaigns?limit=100", "/api/admin/learning/challenges"]);
    const mutations = requests.slice(3);
    assert.deepEqual(mutations.map(r => [r.url, r.init.method]), [
      ["/api/admin/engagement/announcements", "POST"], ["/api/admin/engagement/announcements/4", "PATCH"],
      ["/api/admin/engagement/campaigns", "PATCH"], ["/api/admin/engagement/campaigns", "PATCH"],
      ["/api/admin/learning/challenges", "POST"], ["/api/admin/learning/challenges/6", "PATCH"],
      ["/api/admin/engagement/announcements", "POST"],
    ]);
    assert.deepEqual(mutations.map(r => JSON.parse(String(r.init.body))), [
      { title: "News", body: "Update", reason: "Approved review" }, { pinned: true, reason: "Approved review" },
      { campaignId: 5, active: false, reason: "Approved review" }, { campaignId: 5, active: true, reason: "Approved review" },
      { title: "Theme", question: "How?", deadlineAt: "2030-01-01T00:00:00.000Z", active: true, reason: "Approved review" },
      { active: false, reason: "Approved review" }, { title: "News", body: "Update", reason: "Approved review" },
    ]);
    for (const r of mutations) assert.equal(new Headers(r.init.headers).get("Idempotency-Key"), "stable-retry-key");
    assert.equal(mutations[0].init.body, mutations[6].init.body);
  } finally { globalThis.fetch = original; }
});

test("engagement errors retain the server message for actionable retry", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ data: null, error: { code: "conflict", message: "Expired campaign cannot be opened." }, requestId: "failure" }), { status: 409 })) as typeof fetch;
  try { await assert.rejects(executeEngagementCommand({ command: { kind: "campaign-status", id: 5, active: true }, reason: "Review", idempotencyKey: "stable-retry-key" }), /Expired campaign cannot be opened/); }
  finally { globalThis.fetch = original; }
});
