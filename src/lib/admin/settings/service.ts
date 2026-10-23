import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../../../db/connection";
import { auditEvents, ideaSettings, pointRules, quizRecommendationRules, refreshTokens, users } from "../../../db/schema";
import { isSessionActive } from "../../../auth/security-core";
import { buildAuditRecord } from "../../audit/service";
import { requirePrivilegedReason, AuthorizationError } from "../../auth/authorization-core";
import { AdminInputError } from "../query";

type Actor = { userId: number; sessionId: number; reason: unknown; ipAddress?: string | null; userAgent?: string | null };
const settingKeys = ["minimum_priority_score", "priority_point_rules", "priority_level_rules", "priority_recommendation_rules"] as const;

export async function getAdminSettings() {
  const settings = db.select().from(ideaSettings).where(sql`${ideaSettings.key} IN (${sql.join(settingKeys.map((key) => sql`${key}`), sql`, `)})`).all();
  return {
    priority: Object.fromEntries(settings.map(({ key, value }) => [key, value])),
    pointRules: db.select().from(pointRules).orderBy(asc(pointRules.code)).all(),
    recommendationRules: db.select().from(quizRecommendationRules).orderBy(asc(quizRecommendationRules.topic)).all(),
  };
}

function assertActor(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], actor: Actor, now: Date) {
  const user = tx.select().from(users).where(eq(users.id, actor.userId)).limit(1).get();
  const session = tx.select().from(refreshTokens).where(eq(refreshTokens.id, actor.sessionId)).limit(1).get();
  if (!user || user.role !== "admin" || !user.isActive || !session || session.userId !== user.id || !isSessionActive(session, user, now)) throw new AuthorizationError("Administrator session is no longer valid.");
}

export async function updateAdminSettings(actor: Actor, input: { priority?: Partial<Record<typeof settingKeys[number], string>>; pointRules?: Array<{ code: string; points: number; active: boolean }>; recommendationRules?: Array<{ topic: string; thresholdPercent: number; reasonTemplate: string; active: boolean }> }) {
  const reason = requirePrivilegedReason(actor.reason);
  for (const [key, value] of Object.entries(input.priority ?? {})) {
    if (!settingKeys.includes(key as typeof settingKeys[number])) throw new AdminInputError("Unknown priority setting.");
    if (key === "minimum_priority_score" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 3)) throw new AdminInputError("Minimum priority score must be between 0 and 3.");
    if (key !== "minimum_priority_score") {
      try { if (!JSON.parse(value!) || typeof JSON.parse(value!) !== "object") throw new Error(); }
      catch { throw new AdminInputError("Priority rule settings must contain a JSON object or array."); }
    }
  }
  for (const rule of input.pointRules ?? []) if (!db.select({ id: pointRules.id }).from(pointRules).where(eq(pointRules.code, rule.code)).get()) throw new AdminInputError("Unknown point rule code.");
  const now = new Date();
  return db.transaction((tx) => {
    assertActor(tx, actor, now);
    for (const [key, value] of Object.entries(input.priority ?? {})) tx.insert(ideaSettings).values({ key, value: value!, updatedBy: actor.userId, updatedAt: now }).onConflictDoUpdate({ target: ideaSettings.key, set: { value: value!, updatedBy: actor.userId, updatedAt: now } }).run();
    for (const rule of input.pointRules ?? []) tx.update(pointRules).set({ points: rule.points, active: rule.active, updatedAt: now }).where(eq(pointRules.code, rule.code)).run();
    for (const rule of input.recommendationRules ?? []) tx.insert(quizRecommendationRules).values({ ...rule, updatedAt: now }).onConflictDoUpdate({ target: quizRecommendationRules.topic, set: { thresholdPercent: rule.thresholdPercent, reasonTemplate: rule.reasonTemplate, active: rule.active, updatedAt: now } }).run();
    tx.insert(auditEvents).values(buildAuditRecord({ actorUserId: actor.userId, sessionId: actor.sessionId, action: "admin.settings.updated", targetType: "admin_settings", reason, metadata: { priorityKeys: Object.keys(input.priority ?? {}), pointRuleCodes: (input.pointRules ?? []).map((r) => r.code), recommendationTopics: (input.recommendationRules ?? []).map((r) => r.topic) }, ipAddress: actor.ipAddress, userAgent: actor.userAgent }, now)).run();
    return { updated: true };
  });
}
