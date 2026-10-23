import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../../../db/connection";
import { auditEvents, ideaSettings, levels, pointRules, quizRecommendationRules, refreshTokens, users } from "../../../db/schema";
import { isSessionActive } from "../../../auth/security-core";
import { buildAuditRecord } from "../../audit/service";
import { requirePrivilegedReason, AuthorizationError } from "../../auth/authorization-core";
import { AdminInputError } from "../query";

type Actor = { userId: number; sessionId: number; reason: unknown; ipAddress?: string | null; userAgent?: string | null };
const settingKeys = ["minimum_priority_score", "priority_point_rules", "priority_level_rules", "priority_recommendation_rules", "priority_kpis", "priority_bands", "sla_days", "required_controls", "departments", "demo_access", "profiles"] as const;

export async function getAdminSettings() {
  const settings = db.select().from(ideaSettings).where(sql`${ideaSettings.key} IN (${sql.join(settingKeys.map((key) => sql`${key}`), sql`, `)})`).all();
  return {
    priority: Object.fromEntries(settings.map(({ key, value }) => [key, value])),
    levels: db.select().from(levels).orderBy(asc(levels.sortOrder)).all(),
    departments: Array.from(new Set(db.select({ department: users.department }).from(users).all().map(({ department }) => department))).sort(),
    pointRules: db.select().from(pointRules).orderBy(asc(pointRules.code)).all(),
    recommendationRules: db.select().from(quizRecommendationRules).orderBy(asc(quizRecommendationRules.topic)).all(),
  };
}

function assertActor(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], actor: Actor, now: Date) {
  const user = tx.select().from(users).where(eq(users.id, actor.userId)).limit(1).get();
  const session = tx.select().from(refreshTokens).where(eq(refreshTokens.id, actor.sessionId)).limit(1).get();
  if (!user || (user.role !== "admin" && user.profile !== "admin") || !user.isActive || !session || session.userId !== user.id || !isSessionActive(session, user, now)) throw new AuthorizationError("Administrator session is no longer valid.");
}

export async function updateAdminSettings(actor: Actor, input: { priority?: Partial<Record<typeof settingKeys[number], string>>; pointRules?: Array<{ code: string; points: number; active: boolean }>; recommendationRules?: Array<{ topic: string; thresholdPercent: number; reasonTemplate: string; active: boolean }>; levels?: Array<{ id: number; name: string; description: string | null; minimumPoints: number; sortOrder: number }> }) {
  const reason = requirePrivilegedReason(actor.reason);
  for (const [key, value] of Object.entries(input.priority ?? {})) {
    if (!settingKeys.includes(key as typeof settingKeys[number])) throw new AdminInputError("Unknown priority setting.");
    if (key === "minimum_priority_score" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 3)) throw new AdminInputError("Minimum priority score must be between 0 and 3.");
    if (key !== "minimum_priority_score") {
      try {
        const parsed: unknown = JSON.parse(value!);
        if (!parsed || typeof parsed !== "object") throw new Error();
        if (key === "sla_days" && Object.values(parsed).some((day) => !Number.isInteger(day) || Number(day) < 0 || Number(day) > 365)) throw new Error();
        if (key === "required_controls" && (!Array.isArray(parsed) || parsed.length > 100 || parsed.some((item) => typeof item !== "string" || !item.trim() || item.length > 500))) throw new Error();
        if (key === "departments" && (!Array.isArray(parsed) || parsed.length > 200 || parsed.some((item) => typeof item !== "string" || !item.trim() || item.length > 120))) throw new Error();
        if (key === "profiles" && (!Array.isArray(parsed) || parsed.length > 6 || parsed.some((item) => !["employee", "reviewer", "business_owner", "control", "management", "admin"].includes(String(item))))) throw new Error();
        if (key === "demo_access" && (!("enabled" in parsed) || typeof parsed.enabled !== "boolean")) throw new Error();
        if (key === "priority_kpis" && Array.isArray(parsed) && (parsed.length > 10 || parsed.some((item) => !item || typeof item !== "object" || Object.values(item).some((value) => typeof value === "string" && value.length > 500) || ("weight" in item && (typeof item.weight !== "number" || item.weight < 0 || item.weight > 1))))) throw new Error();
        if (key === "priority_bands" && Array.isArray(parsed) && (parsed.length > 10 || parsed.some((item) => !item || typeof item !== "object" || typeof item.name !== "string" || !item.name.trim() || item.name.length > 80 || typeof item.minimum !== "number" || !Number.isFinite(item.minimum) || item.minimum < 0 || item.minimum > 3))) throw new Error();
        if (["priority_kpis", "priority_bands", "priority_point_rules", "priority_level_rules", "priority_recommendation_rules"].includes(key) && !Array.isArray(parsed) && Object.getPrototypeOf(parsed) !== Object.prototype) throw new Error();
      } catch { throw new AdminInputError("Policy settings contain invalid or out-of-range values."); }
    }
  }
  for (const rule of input.pointRules ?? []) if (!db.select({ id: pointRules.id }).from(pointRules).where(eq(pointRules.code, rule.code)).get()) throw new AdminInputError("Unknown point rule code.");
  for (const rule of input.recommendationRules ?? []) if (!Number.isInteger(rule.thresholdPercent) || rule.thresholdPercent < 0 || rule.thresholdPercent > 100 || !rule.topic.trim() || !rule.reasonTemplate.trim()) throw new AdminInputError("Invalid recommendation rule.");
  const levelIds = new Set<number>();
  for (const level of input.levels ?? []) {
    if (!Number.isSafeInteger(level.id) || levelIds.has(level.id) || !level.name.trim() || level.name.length > 120 || (level.description?.length ?? 0) > 500 || !Number.isInteger(level.minimumPoints) || level.minimumPoints < 0 || level.minimumPoints > 10000000 || !Number.isInteger(level.sortOrder) || level.sortOrder < 0 || level.sortOrder > 100 || !db.select({ id: levels.id }).from(levels).where(eq(levels.id, level.id)).get()) throw new AdminInputError("Invalid level configuration.");
    levelIds.add(level.id);
  }
  const now = new Date();
  return db.transaction((tx) => {
    assertActor(tx, actor, now);
    for (const [key, value] of Object.entries(input.priority ?? {})) tx.insert(ideaSettings).values({ key, value: value!, updatedBy: actor.userId, updatedAt: now }).onConflictDoUpdate({ target: ideaSettings.key, set: { value: value!, updatedBy: actor.userId, updatedAt: now } }).run();
    for (const rule of input.pointRules ?? []) tx.update(pointRules).set({ points: rule.points, active: rule.active, updatedAt: now }).where(eq(pointRules.code, rule.code)).run();
    for (const level of input.levels ?? []) tx.update(levels).set({ name: level.name.trim(), description: level.description?.trim() || null, minimumPoints: level.minimumPoints, sortOrder: level.sortOrder, updatedAt: now }).where(eq(levels.id, level.id)).run();
    for (const rule of input.recommendationRules ?? []) {
      const existing = tx.select({ id: quizRecommendationRules.id }).from(quizRecommendationRules).where(eq(quizRecommendationRules.topic, rule.topic)).get();
      if (existing) tx.update(quizRecommendationRules).set({ thresholdPercent: rule.thresholdPercent, reasonTemplate: rule.reasonTemplate, active: rule.active, updatedAt: now }).where(eq(quizRecommendationRules.id, existing.id)).run();
      else tx.insert(quizRecommendationRules).values({ ...rule, updatedAt: now }).run();
    }
    tx.insert(auditEvents).values(buildAuditRecord({ actorUserId: actor.userId, sessionId: actor.sessionId, action: "admin.settings.updated", targetType: "admin_settings", reason, metadata: { priorityKeys: Object.keys(input.priority ?? {}), pointRuleCodes: (input.pointRules ?? []).map((r) => r.code), recommendationTopics: (input.recommendationRules ?? []).map((r) => r.topic), levelIds: (input.levels ?? []).map((level) => level.id) }, ipAddress: actor.ipAddress, userAgent: actor.userAgent }, now)).run();
    return { updated: true };
  });
}
