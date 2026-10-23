import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/connection";
import { articles, articleCompletions, auditEvents, feedbackCampaigns, feedbackResponses, notifications, pointRules, quizRecommendations } from "../../db/schema";
import { awardPoints } from "../rewards/service";
import { createGeminiProvider } from "../ai/gemini-provider-core";
import { getAiConfig } from "../ai/config-core";
import { hashAuditValue, serializeAuditMetadata } from "../audit/redaction-core";

export class LibraryError extends Error { constructor(message: string, public code: string, public status = 400) { super(message); } }
export type RequestContext = { userId: number; sessionId: number; ipAddress?: string | null; userAgent?: string | null; requestId?: string | null };
const textSchema = z.string().trim().min(1).max(4000);
function audit(ctx: RequestContext, action: string, type: string, targetId: number, metadata: unknown) {
  const details = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : { details: metadata };
  return { actorUserId: ctx.userId, sessionId: ctx.sessionId, action, targetType: type, targetId: String(targetId), reason: null, metadataJson: serializeAuditMetadata({ ...(details as Record<string, unknown>), requestId: ctx.requestId }), ipHash: hashAuditValue(ctx.ipAddress), userAgentHash: hashAuditValue(ctx.userAgent), createdAt: new Date() };
}
function sourceUrl(url: string | null) {
  if (!url) return null;
  try { const parsed = new URL(url); return parsed.protocol === "https:" ? parsed.toString() : null; } catch { return null; }
}
export async function listLibrary(userId: number, category?: string, recommended = false) {
  if (recommended) {
    const recs = await db.select().from(quizRecommendations).where(and(eq(quizRecommendations.userId, userId), eq(quizRecommendations.status, "open"))).orderBy(desc(quizRecommendations.createdAt)).all();
    const result = [];
    for (const rec of recs) {
      const matches = await db.select().from(articles).where(and(eq(articles.published, true), or(eq(articles.topic, rec.topic), eq(articles.categoryCode, rec.categoryCode)))).all();
      for (const article of matches) result.push({ ...publicArticle(article), recommendation: { id: rec.id, topic: rec.topic, scorePercent: rec.scorePercent, thresholdPercent: rec.thresholdPercent, reason: rec.reason } });
    }
    return { items: result, emptyMessage: result.length ? null : "Complete a quiz to get reading recommendations for your learning gaps." };
  }
  const conditions = [eq(articles.published, true)];
  if (category) conditions.push(eq(articles.categoryCode, category));
  const rows = await db.select().from(articles).where(and(...conditions)).orderBy(desc(articles.updatedAt)).all();
  return { items: rows.map(publicArticle), emptyMessage: null };
}
function publicArticle(article: typeof articles.$inferSelect) {
  return { id: article.id, publisher: article.publisher, title: article.title, summary: article.summary, category: article.categoryCode, topic: article.topic, difficulty: article.difficulty, readingMinutes: article.readingMinutes, contentType: article.contentType, body: article.contentType === "internal" ? article.body : null, sourceUrl: article.contentType === "external" ? sourceUrl(article.url) : null };
}
export async function getLibraryArticle(articleId: number) {
  const [row] = await db.select().from(articles).where(and(eq(articles.id, articleId), eq(articles.published, true))).limit(1).all();
  if (!row) throw new LibraryError("Article not found.", "ARTICLE_NOT_FOUND", 404);
  return publicArticle(row);
}
export async function listRecommendations(userId: number) { return listLibrary(userId, undefined, true); }
export async function completeArticle(ctx: RequestContext, articleId: number, idempotencyKey: string) {
  const key = z.string().trim().min(8).max(200).parse(idempotencyKey);
  const result = db.transaction((tx) => {
    const [article] = tx.select().from(articles).where(and(eq(articles.id, articleId), eq(articles.published, true))).limit(1).all();
    if (!article) throw new LibraryError("Article not found.", "ARTICLE_NOT_FOUND", 404);
    const [keyUse] = tx.select().from(articleCompletions).where(and(eq(articleCompletions.userId, ctx.userId), eq(articleCompletions.idempotencyKey, key))).limit(1).all();
    if (keyUse && keyUse.articleId !== articleId) throw new LibraryError("Idempotency key was already used for another article.", "IDEMPOTENCY_CONFLICT", 409);
    const [existing] = tx.select().from(articleCompletions).where(and(eq(articleCompletions.userId, ctx.userId), eq(articleCompletions.articleId, articleId))).limit(1).all();
    if (existing) return { completionId: existing.id, alreadyCompleted: true, pointsAwarded: existing.pointsAwarded, badgeAwards: [] };
    const [recommendation] = tx.select().from(quizRecommendations).where(and(eq(quizRecommendations.userId, ctx.userId), eq(quizRecommendations.status, "open"), or(eq(quizRecommendations.topic, article.topic ?? ""), eq(quizRecommendations.categoryCode, article.categoryCode)))).limit(1).all();
    const [completion] = tx.insert(articleCompletions).values({ userId: ctx.userId, articleId, recommendationId: recommendation?.id ?? null, idempotencyKey: key, pointsAwarded: 0, completedAt: new Date() }).returning().all();
    if (recommendation) tx.update(quizRecommendations).set({ status: "completed", updatedAt: new Date() }).where(eq(quizRecommendations.id, recommendation.id)).run();
    tx.insert(auditEvents).values(audit(ctx, "article.completed", "article", articleId, { completionId: completion.id, recommendationId: recommendation?.id ?? null })).run();
    return { completionId: completion.id, alreadyCompleted: false, recommendationId: recommendation?.id ?? null };
  });
  {
    const [rule] = await db.select().from(pointRules).where(and(eq(pointRules.code, "article_read"), eq(pointRules.active, true))).limit(1).all();
    if (result.alreadyCompleted && (result.pointsAwarded ?? 0) > 0) return { ...result, completed: true };
    let award: Awaited<ReturnType<typeof awardPoints>> | null = null;
    if (rule && rule.points > 0) award = await awardPoints({ userId: ctx.userId, amount: rule.points, eventType: "article_read", sourceType: "article", sourceId: String(articleId), idempotencyKey: `article:${articleId}:user:${ctx.userId}:read`, actorUserId: ctx.userId, sessionId: ctx.sessionId, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
    if (award) await db.update(articleCompletions).set({ pointsAwarded: rule!.points }).where(eq(articleCompletions.id, result.completionId)).run();
    return { ...result, completed: true, pointsAwarded: award ? rule!.points : 0, badgeAwards: award?.awarded ?? [] };
  }
}
export async function articleInsight(ctx: RequestContext, articleId: number, recommendationId: number) {
  if (!Number.isInteger(articleId) || articleId < 1 || !Number.isInteger(recommendationId) || recommendationId < 1) throw new LibraryError("Invalid article insight request.", "VALIDATION_ERROR", 400);
  const [recommendation] = await db.select().from(quizRecommendations).where(and(eq(quizRecommendations.id, recommendationId), eq(quizRecommendations.userId, ctx.userId), inArray(quizRecommendations.status, ["open", "completed"]))).limit(1).all();
  if (!recommendation) throw new LibraryError("Recommendation not found.", "RECOMMENDATION_NOT_FOUND", 404);
  const [article] = await db.select().from(articles).where(and(eq(articles.id, articleId), eq(articles.published, true))).limit(1).all();
  if (!article) throw new LibraryError("Article not found.", "ARTICLE_NOT_FOUND", 404);
  if (article.topic !== recommendation.topic && article.categoryCode !== recommendation.categoryCode) throw new LibraryError("Article is not part of this recommendation.", "RECOMMENDATION_MISMATCH", 403);
  const fallback = recommendation.reason.slice(0, 240);
  try {
    const config = getAiConfig();
    if (!config.apiKey) {
      await db.insert(auditEvents).values(audit(ctx, "article.insight.generated", "article", articleId, { recommendationId, source: "rule" })).run();
      return { insight: fallback, source: "rule" as const };
    }
    const provider = createGeminiProvider(config);
    const response = await provider.generateStructured({ model: config.model, systemPrompt: "Write one brief, factual sentence connecting a bank employee's learning gap to this article. Use only supplied information. Do not infer personal traits or disclose sensitive data.", userContent: JSON.stringify({ topic: recommendation.topic, scorePercent: recommendation.scorePercent, recommendationReason: recommendation.reason, articleTitle: article.title, articleSummary: article.summary }), responseMimeType: "application/json", responseJsonSchema: { type: "object", properties: { insight: { type: "string", minLength: 1, maxLength: 240 } }, required: ["insight"], additionalProperties: false }, maxOutputTokens: 120, temperature: 0, timeoutMs: config.timeoutMs });
    const parsed = z.object({ insight: z.string().trim().min(1).max(240) }).safeParse(JSON.parse(response.text));
    const source = parsed.success ? "gemini" as const : "rule" as const;
    await db.insert(auditEvents).values(audit(ctx, "article.insight.generated", "article", articleId, { recommendationId, source })).run();
    return parsed.success ? { insight: parsed.data.insight, source } : { insight: fallback, source };
  } catch {
    await db.insert(auditEvents).values(audit(ctx, "article.insight.generated", "article", articleId, { recommendationId, source: "rule" })).run();
    return { insight: fallback, source: "rule" as const };
  }
}

export async function getFeedback(userId: number) {
  const now = new Date();
  const campaigns = await db.select().from(feedbackCampaigns).where(eq(feedbackCampaigns.active, true)).orderBy(desc(feedbackCampaigns.pinned), desc(feedbackCampaigns.updatedAt)).all();
  const active = campaigns.find((campaign) => (!campaign.startsAt || campaign.startsAt <= now) && (!campaign.endsAt || campaign.endsAt >= now)) ?? null;
  const responses = active ? await db.select().from(feedbackResponses).where(and(eq(feedbackResponses.userId, userId), eq(feedbackResponses.campaignId, active.id))).orderBy(desc(feedbackResponses.createdAt)).all() : [];
  return { campaign: active ? { id: active.id, title: active.title, description: active.description, pinned: active.pinned } : null, responses: responses.map((r) => ({ id: r.id, category: r.category, message: r.message, response: r.response, respondedAt: r.respondedAt, createdAt: r.createdAt })) };
}
export async function submitFeedback(ctx: RequestContext, input: { category: string; message: string; idempotencyKey: string }) {
  const data = z.object({ category: z.enum(["experience", "ideas", "content", "technical", "other"]), message: textSchema, idempotencyKey: z.string().trim().min(8).max(200) }).parse(input);
  return db.transaction((tx) => {
    const now = new Date();
    const [campaign] = tx.select().from(feedbackCampaigns).where(and(eq(feedbackCampaigns.active, true), eq(feedbackCampaigns.pinned, true))).orderBy(desc(feedbackCampaigns.updatedAt)).limit(1).all();
    if (!campaign || (campaign.startsAt && campaign.startsAt > now) || (campaign.endsAt && campaign.endsAt < now)) throw new LibraryError("There is no active feedback campaign.", "CAMPAIGN_CLOSED", 409);
    const [existing] = tx.select().from(feedbackResponses).where(and(eq(feedbackResponses.userId, ctx.userId), eq(feedbackResponses.idempotencyKey, data.idempotencyKey))).limit(1).all();
    if (existing) return { id: existing.id, duplicate: true };
    const [row] = tx.insert(feedbackResponses).values({ campaignId: campaign.id, userId: ctx.userId, category: data.category, message: data.message, idempotencyKey: data.idempotencyKey, createdAt: now, updatedAt: now }).returning().all();
    tx.insert(auditEvents).values(audit(ctx, "feedback.submitted", "feedback", row.id, { campaignId: campaign.id, category: row.category })).run();
    tx.insert(notifications).values({ userId: ctx.userId, type: "feedback_received", title: "Feedback received", body: "Thank you for helping improve the platform.", link: "/private/feedback", createdAt: now, updatedAt: now }).run();
    return { id: row.id, duplicate: false };
  });
}
export async function respondToFeedback(ctx: RequestContext, responseId: number, message: string) {
  const body = textSchema.max(2000).parse(message);
  return db.transaction((tx) => {
    const [row] = tx.select().from(feedbackResponses).where(eq(feedbackResponses.id, responseId)).limit(1).all();
    if (!row) throw new LibraryError("Feedback not found.", "FEEDBACK_NOT_FOUND", 404);
    if (row.respondedAt) throw new LibraryError("Feedback has already been answered.", "ALREADY_RESPONDED", 409);
    const now = new Date();
    tx.update(feedbackResponses).set({ respondedBy: ctx.userId, response: body, respondedAt: now, updatedAt: now }).where(eq(feedbackResponses.id, responseId)).run();
    tx.insert(auditEvents).values(audit(ctx, "feedback.responded", "feedback", responseId, { status: "responded" })).run();
    tx.insert(notifications).values({ userId: row.userId, type: "feedback_response", title: "A response to your feedback", body, link: "/private/feedback", createdAt: now, updatedAt: now }).run();
    return { id: responseId, respondedAt: now };
  });
}
