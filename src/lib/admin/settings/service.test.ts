import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "../../../db/connection";
import { auditEvents, ideaSettings, refreshTokens, users } from "../../../db/schema";
import { getAdminSettings, updateAdminSettings } from "./service";

test("admin policy settings include all supported workflow controls and persist them with an audit reason", async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const admin = db.insert(users).values({ name: "Settings admin", email: `settings-${stamp}@example.test`, role: "admin", profile: "admin", passwordHash: "test" }).returning().get();
  const session = db.insert(refreshTokens).values({ userId: admin.id, tokenHash: `settings-${stamp}`, expiresAt: new Date(Date.now() + 60_000) }).returning().get();
  const actor = { userId: admin.id, sessionId: session.id, reason: "Approved policy review" };
  const priority = {
    priority_kpis: JSON.stringify([{ key: "turnaround", question: "Time saved?", hint: "Estimate days", weight: 0.3 }]),
    priority_bands: JSON.stringify([{ name: "Watch", minimum: 0 }, { name: "Priority", minimum: 2.5 }]),
    sla_days: JSON.stringify({ screening: 5, business_review: 10 }),
    required_controls: JSON.stringify(["risk review"]),
    departments: JSON.stringify(["Treasury", "Risk"]),
    demo_access: JSON.stringify({ enabled: false }),
    profiles: JSON.stringify(["employee", "reviewer", "admin"]),
  };
  try {
    await updateAdminSettings(actor, { priority });
    const settings = await getAdminSettings();
    for (const [key, value] of Object.entries(priority)) assert.equal(settings.priority[key], value);
    const audit = db.select().from(auditEvents).where(eq(auditEvents.action, "admin.settings.updated")).all().find((row) => row.actorUserId === admin.id);
    assert.equal(audit?.reason, actor.reason);
  } finally {
    db.update(users).set({ isActive: false }).where(eq(users.id, admin.id)).run();
    db.delete(ideaSettings).where(eq(ideaSettings.updatedBy, admin.id)).run();
  }
});

test("admin policy validation rejects malformed bounded controls without writing settings", async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const admin = db.insert(users).values({ name: "Settings admin", email: `settings-invalid-${stamp}@example.test`, role: "admin", profile: "admin", passwordHash: "test" }).returning().get();
  const session = db.insert(refreshTokens).values({ userId: admin.id, tokenHash: `settings-invalid-${stamp}`, expiresAt: new Date(Date.now() + 60_000) }).returning().get();
  try {
    await assert.rejects(updateAdminSettings({ userId: admin.id, sessionId: session.id, reason: "Invalid controls" }, { priority: { sla_days: JSON.stringify({ screening: 999 }) } }));
    assert.equal(db.select().from(ideaSettings).where(eq(ideaSettings.key, "sla_days")).get(), undefined);
  } finally { db.update(users).set({ isActive: false }).where(eq(users.id, admin.id)).run(); }
});
