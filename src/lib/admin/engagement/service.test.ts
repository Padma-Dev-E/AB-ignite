import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../../../db/connection";
import { announcements, auditEvents, feedbackCampaigns, notifications, refreshTokens, users } from "../../../db/schema";
import { createAnnouncement, setAnnouncementPinned, setCampaignActive } from "./service";

function principal(role: "admin" | "user" = "admin") {
  const stamp = `${Date.now()}-${Math.random()}`;
  const user = db.insert(users).values({ name: "Engagement actor", email: `eng-${stamp}@example.test`, role, profile: role === "admin" ? "admin" : "employee", passwordHash: "test" }).returning({ id: users.id }).get();
  const session = db.insert(refreshTokens).values({ userId: user.id, tokenHash: `eng-${stamp}`, expiresAt: new Date(Date.now() + 60_000), sessionVersion: 0 }).returning({ id: refreshTokens.id }).get();
  return { userId: user.id, sessionId: session.id, reason: "Approved engagement update" };
}

test("announcement creation is idempotent and pin changes notify employees once", () => {
  const actor = principal();
  const input = { title: "Quarterly update", body: "Read the new update." };
  const key = `announce-${Date.now()}`;
  const first = createAnnouncement(actor, input, key);
  assert.deepEqual(createAnnouncement(actor, input, key), first);
  setAnnouncementPinned(actor, first.id, true, `${key}-pin`);
  setAnnouncementPinned(actor, first.id, true, `${key}-pin`);
  assert.equal(db.select().from(announcements).where(eq(announcements.id, first.id)).get()?.pinned, true);
  assert.equal(db.select().from(notifications).where(eq(notifications.type, "announcement_published")).all().filter((n) => n.link === `/announcements/${first.id}`).length, 1);
  assert.ok(db.select().from(auditEvents).where(eq(auditEvents.targetId, String(first.id))).all().length >= 2);
});

test("campaign activation is idempotent and requires an authorized current admin", () => {
  const actor = principal();
  const campaign = db.insert(feedbackCampaigns).values({ title: `Campaign ${Date.now()}`, description: "Feedback", active: false, pinned: false }).returning().get();
  const key = `campaign-${Date.now()}`;
  assert.equal(setCampaignActive(actor, campaign.id, true, key).active, true);
  assert.equal(setCampaignActive(actor, campaign.id, true, key).active, true);
  assert.equal(db.select().from(notifications).where(eq(notifications.type, "feedback_campaign_opened")).all().filter((n) => n.link === "/private/feedback").length > 0, true);
  assert.throws(() => setCampaignActive(principal("user"), campaign.id, false, `${key}-denied`));
});
