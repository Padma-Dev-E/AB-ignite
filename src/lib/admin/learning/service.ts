import "server-only";
import { asc, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../../../db/connection";
import { articles, auditEvents, quizOptions, quizQuestions, quizVersions, quizzes, refreshTokens, users } from "../../../db/schema";
import { isSessionActive } from "../../../auth/security-core";
import { buildAuditRecord } from "../../audit/service";
import { requirePrivilegedReason, AuthorizationError } from "../../auth/authorization-core";
import { AdminInputError, AdminNotFoundError } from "../query";
import { validateArticleLink, ArticleUrlError } from "./url-validation";

type Page = { limit: number; after: number | null };
type Actor = { userId: number; sessionId: number; reason: unknown; ipAddress?: string | null; userAgent?: string | null };
function page<T extends { id: number }>(rows: T[], limit: number) { const items = rows.slice(0, limit); return { items, nextAfter: rows.length > limit ? items.at(-1)?.id ?? null : null }; }
function assertActor(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], actor: Actor, now: Date) {
  const user = tx.select().from(users).where(eq(users.id, actor.userId)).limit(1).get();
  const session = tx.select().from(refreshTokens).where(eq(refreshTokens.id, actor.sessionId)).limit(1).get();
  if (!user || user.role !== "admin" || !user.isActive || !session || session.userId !== user.id || !isSessionActive(session, user, now)) throw new AuthorizationError("Administrator session is no longer valid.");
}
function writeAudit(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], actor: Actor, reason: string, action: string, type: string, id: number, now: Date) {
  tx.insert(auditEvents).values(buildAuditRecord({ actorUserId: actor.userId, sessionId: actor.sessionId, action, targetType: type, targetId: id, reason, metadata: { status: "updated" }, ipAddress: actor.ipAddress, userAgent: actor.userAgent }, now)).run();
}

export async function listAdminQuizzes(pageInfo: Page) {
  const rows = db.select({ id: quizzes.id, title: quizzes.title, category: quizzes.category, difficulty: quizzes.difficulty, objective: quizzes.objective, versionId: quizVersions.id, version: quizVersions.version, categoryCode: quizVersions.categoryCode, level: quizVersions.level, passMark: quizVersions.passMark, published: quizVersions.published })
    .from(quizzes).leftJoin(quizVersions, eq(quizVersions.quizId, quizzes.id)).orderBy(desc(quizzes.id), desc(quizVersions.version)).all();
  const latest = new Map<number, typeof rows[number]>();
  for (const row of rows) if (!latest.has(row.id)) latest.set(row.id, row);
  const selected = Array.from(latest.values()).filter((row) => pageInfo.after === null || row.id < pageInfo.after).slice(0, pageInfo.limit + 1).map((row) => ({ ...row, questionCount: row.versionId ? Number(db.select({ count: sql<number>`count(*)` }).from(quizQuestions).where(eq(quizQuestions.quizVersionId, row.versionId)).get()?.count ?? 0) : 0 }));
  return page(selected, pageInfo.limit);
}

export async function getAdminQuizQuestions(versionId: number) {
  if (!Number.isSafeInteger(versionId) || versionId < 1) throw new AdminInputError("Invalid quiz version ID.");
  if (!db.select({ id: quizVersions.id }).from(quizVersions).where(eq(quizVersions.id, versionId)).get()) throw new AdminNotFoundError("Quiz version not found.");
  return db.select().from(quizQuestions).where(eq(quizQuestions.quizVersionId, versionId)).orderBy(asc(quizQuestions.sortOrder), asc(quizQuestions.id)).all().map((question) => ({ ...question, options: db.select({ id: quizOptions.id, optionKey: quizOptions.optionKey, label: quizOptions.label, sortOrder: quizOptions.sortOrder, isCorrect: quizOptions.isCorrect }).from(quizOptions).where(eq(quizOptions.questionId, question.id)).orderBy(asc(quizOptions.sortOrder)).all() }));
}

export async function updateAdminQuestion(actor: Actor, questionId: number, input: { prompt: string; topic: string; sortOrder: number; points: number; options: Array<{ optionKey: string; label: string; sortOrder: number; isCorrect: boolean }> }) {
  const reason = requirePrivilegedReason(actor.reason); const now = new Date();
  return db.transaction((tx) => {
    assertActor(tx, actor, now);
    const question = tx.select().from(quizQuestions).where(eq(quizQuestions.id, questionId)).get();
    if (!question) throw new AdminNotFoundError("Question not found.");
    const version = tx.select().from(quizVersions).where(eq(quizVersions.id, question.quizVersionId)).get();
    if (!version || version.published) throw new AdminInputError("Published quiz questions are immutable; create a new version first.");
    tx.update(quizQuestions).set({ prompt: input.prompt, topic: input.topic, sortOrder: input.sortOrder, points: input.points, updatedAt: now }).where(eq(quizQuestions.id, questionId)).run();
    tx.delete(quizOptions).where(eq(quizOptions.questionId, questionId)).run();
    tx.insert(quizOptions).values(input.options.map((option) => ({ ...option, questionId }))).run();
    writeAudit(tx, actor, reason, "admin.learning.question_updated", "quiz_question", questionId, now);
    return { id: questionId, updated: true };
  });
}

export async function listAdminArticles(pageInfo: Page) {
  const rows = db.select().from(articles).where(pageInfo.after ? lt(articles.id, pageInfo.after) : undefined).orderBy(desc(articles.id)).limit(pageInfo.limit + 1).all();
  return page(rows, pageInfo.limit);
}

type ArticleInput = { title: string; summary: string; body: string; category: string; topic?: string | null; publisher: string; difficulty: string; readingMinutes: number; publishedLabel?: string | null; url?: string | null; published: boolean; contentType: "internal" | "external"; categoryCode: string };
function validateArticle(input: ArticleInput) { try { validateArticleLink(input.contentType, input.url ?? null); } catch (error) { if (error instanceof ArticleUrlError) throw new AdminInputError(error.message); throw error; } }
export async function createAdminArticle(actor: Actor, input: ArticleInput) {
  const reason = requirePrivilegedReason(actor.reason); validateArticle(input); const now = new Date();
  return db.transaction((tx) => { assertActor(tx, actor, now); const row = tx.insert(articles).values({ ...input, topic: input.topic ?? null, publishedLabel: input.publishedLabel ?? null, url: input.url ?? null, createdAt: now, updatedAt: now }).returning().get(); writeAudit(tx, actor, reason, "admin.learning.article_created", "article", row.id, now); return row; });
}
export async function updateAdminArticle(actor: Actor, articleId: number, input: ArticleInput) {
  const reason = requirePrivilegedReason(actor.reason); validateArticle(input); const now = new Date();
  return db.transaction((tx) => { assertActor(tx, actor, now); if (!tx.select({ id: articles.id }).from(articles).where(eq(articles.id, articleId)).get()) throw new AdminNotFoundError("Article not found."); const row = tx.update(articles).set({ ...input, topic: input.topic ?? null, publishedLabel: input.publishedLabel ?? null, url: input.url ?? null, updatedAt: now }).where(eq(articles.id, articleId)).returning().get(); writeAudit(tx, actor, reason, "admin.learning.article_updated", "article", articleId, now); return row; });
}
