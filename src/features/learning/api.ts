import { apiFetch } from "../../lib/api/client";
import type { ArticleCompletion, ArticleListResponse, AttemptResponse, AttemptStartResponse, ChallengeSummary, LearningArticle, LearningJourney, QuizAnswer, QuizQuestion, QuizSubmissionResponse, QuizSummary, RankingItem } from "./types";

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
  const result = query.toString();
  return result ? `?${result}` : "";
}

function mutationHeaders(idempotencyKey?: string) {
  return { "content-type": "application/json", ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) };
}

export function listQuizzes() { return apiFetch<{ items: QuizSummary[] }>("/api/quizzes"); }
export function getQuiz(id: number) { return apiFetch<{ id: number; title: string; category: string; difficulty: string; objective: string; versions: Array<{ id: number; version: number; categoryCode: string; level: string; passMark: number; timeLimitSeconds: number | null; questions: QuizQuestion[] }> }>(`/api/quizzes/${id}`); }
export function listJourney() { return apiFetch<LearningJourney>("/api/quizzes/journey"); }
export function listArticles(params: { category?: string } = {}) { return apiFetch<ArticleListResponse>(`/api/articles${queryString(params)}`); }
export function redeemableRecommendations() { return apiFetch<ArticleListResponse>("/api/articles?view=recommended"); }
export function listRankings(scope: "bank" | "department") { return apiFetch<{ scope: "bank" | "department"; items: RankingItem[] }>(`/api/quizzes/rankings?scope=${scope}`); }
export function listChallenges() { return apiFetch<{ items: ChallengeSummary[] }>("/api/challenges"); }
export function getArticle(id: number) { return apiFetch<LearningArticle>(`/api/articles/${id}`); }
export function getArticleInsight(articleId: number, recommendationId: number) {
  return apiFetch<{ insight: string; source: "gemini" | "rule" }>(`/api/articles/${articleId}/insight`, { method: "POST", headers: mutationHeaders(), body: JSON.stringify({ recommendationId }) });
}
export function startQuizAttempt(quizId: number, idempotencyKey: string) {
  return apiFetch<AttemptStartResponse>(`/api/quizzes/${quizId}/attempts`, { method: "POST", headers: mutationHeaders(idempotencyKey), body: JSON.stringify({ idempotencyKey }) });
}
export function getQuizAttempt(attemptId: number) { return apiFetch<AttemptResponse>(`/api/quizzes/attempts/${attemptId}`); }
export function submitQuizAttempt(attemptId: number, answers: QuizAnswer[]) {
  return apiFetch<QuizSubmissionResponse>(`/api/quizzes/attempts/${attemptId}/submit`, { method: "POST", headers: mutationHeaders(), body: JSON.stringify({ answers }) });
}
export function completeArticle(articleId: number, idempotencyKey: string) {
  return apiFetch<ArticleCompletion>(`/api/articles/${articleId}/read`, { method: "POST", headers: mutationHeaders(idempotencyKey), body: JSON.stringify({ idempotencyKey }) });
}
export function joinChallenge(challengeId: number, idempotencyKey: string) {
  return apiFetch<{ participant: unknown; pointsAwarded: number }>(`/api/challenges/${challengeId}/join`, { method: "POST", headers: mutationHeaders(idempotencyKey), body: JSON.stringify({ idempotencyKey }) });
}
