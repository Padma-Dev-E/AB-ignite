import assert from "node:assert/strict";
import test, { before } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db/connection";
import { announcements, auditEvents, feedbackCampaigns, refreshTokens, users } from "../src/db/schema";
import { createAnnouncement, listAnnouncements, listCampaigns, setAnnouncementPinned, setCampaignActive } from "../src/lib/admin/engagement/service";

let adminId = 0;
let userId = 0;
let adminSessionId = 0;
let userSessionId = 0;

before(() => {
  const stamp = Date.now();
  const admin = db.insert(users).values({ name: "Engagement admin", email: `eng-admin-${stamp}@example.test`, role: "back_office", passwordHash: "test" }).returning({ id: users.id }).get();
  const user = db.insert(users).values({ name: "Engagement employee", email: `eng-user-${stamp}@example.test`, role: "employee", passwordHash: "test" }).returning({ id: users.id }).get();
  adminId = admin.id;
  userId = user.id;
  const adminSession = db.insert(refreshTokens).values({ userId: adminId, tokenHash: `eng-admin-${stamp}`, expiresAt: new Date(Date.now() + 60_000), idleExpiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000), sessionVersion: 0 }).returning({ id: refreshTokens.id }).get();
  const userSession = db.insert(refreshTokens).values({ userId, tokenHash: `eng-user-${stamp}`, expiresAt: new Date(Date.now() + 60_000), idleExpiresAt: new Date(Date.now() + 60_000), absoluteExpiresAt: new Date(Date.now() + 60_000), sessionVersion: 0 }).returning({ id: refreshTokens.id }).get();
  adminSessionId = adminSession.id;
  userSessionId = userSession.id;
});

const admin = (reason: unknown = "approved engagement change") => ({ userId: adminId, sessionId: adminSessionId, reason });

test("announcement lifecycle is audited, idempotent, and keeps one pinned item", () => {
  const first = createAnnouncement(admin(), { title: "First update", body: "First body" }, "announcement-create-1");
  const replay = createAnnouncement(admin(), { title: "First update", body: "First body" }, "announcement-create-1");
  assert.equal(replay.id, first.id);
  assert.throws(() => createAnnouncement(admin(), { title: "Different", body: "Different body" }, "announcement-create-1"), /idempotency/i);
  const second = createAnnouncement(admin(), { title: "Second update", body: "Second body" }, "announcement-create-2");
  setAnnouncementPinned(admin(), first.id, true, "announcement-pin-1");
  setAnnouncementPinned(admin(), second.id, true, "announcement-pin-2");
  assert.equal(db.select().from(announcements).where(and(eq(announcements.pinned, true), sql`${announcements.id} in (${first.id}, ${second.id})`)).all().length, 1);
  assert.equal(listAnnouncements().find((item) => item.id === second.id)?.pinned, true);
  assert.equal(listAnnouncements().find((item) => item.id === first.id)?.published, true);
  assert.ok(db.select().from(auditEvents).where(eq(auditEvents.action, "admin.engagement.announcement.pin")).all().length >= 1);
});

test("feedback campaigns can be opened and closed with replay protection", () => {
  const created = db.insert(feedbackCampaigns).values({ title: "Quarterly feedback", description: "Tell us what to improve.", active: false, pinned: false }).returning().get();
  assert.equal(listCampaigns().find((item) => item.id === created.id)?.pinned, false);
  const opened = setCampaignActive(admin(), created.id, true, "campaign-open-1");
  assert.equal(opened.active, true);
  const replay = setCampaignActive(admin(), created.id, true, "campaign-open-1");
  assert.equal(replay.active, true);
  const closed = setCampaignActive(admin(), created.id, false, "campaign-close-1");
  assert.equal(closed.active, false);
  assert.equal(listCampaigns().find((item) => item.id === created.id)?.active, false);
});

test("non-admin engagement mutations are rejected", () => {
  assert.throws(() => createAnnouncement({ userId, sessionId: userSessionId, reason: "not allowed" }, { title: "Nope", body: "Nope" }, "announcement-denied-1"), /administrator|permission|authorized/i);
});
