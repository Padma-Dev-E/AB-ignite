"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { completeArticle, getArticle, getQuizAttempt, joinChallenge, listArticles, listChallenges, listJourney, listQuizzes, listRankings, redeemableRecommendations, startQuizAttempt, submitQuizAttempt } from "./api";
import type { QuizAnswer } from "./types";

export const learningQueryKeys = {
  all: ["learning"] as const,
  quizzes: () => ["learning", "quizzes"] as const,
  journey: () => ["learning", "journey"] as const,
  articles: (category?: string) => ["learning", "articles", category ?? "all"] as const,
  recommendations: () => ["learning", "recommendations"] as const,
  article: (id: number) => ["learning", "article", id] as const,
  attempt: (id: number) => ["learning", "attempt", id] as const,
  rankings: (scope: "bank" | "department") => ["learning", "rankings", scope] as const,
  challenges: () => ["learning", "challenges"] as const,
};

export function useQuizzes() { return useQuery({ queryKey: learningQueryKeys.quizzes(), queryFn: listQuizzes }); }
export function useLearningJourney() { return useQuery({ queryKey: learningQueryKeys.journey(), queryFn: listJourney }); }
export function useArticles(category?: string) { return useQuery({ queryKey: learningQueryKeys.articles(category), queryFn: () => listArticles({ category }) }); }
export function useLearningRecommendations() { return useQuery({ queryKey: learningQueryKeys.recommendations(), queryFn: redeemableRecommendations }); }
export function useLearningRankings(scope: "bank" | "department") { return useQuery({ queryKey: learningQueryKeys.rankings(scope), queryFn: () => listRankings(scope) }); }
export function useLearningChallenges() { return useQuery({ queryKey: learningQueryKeys.challenges(), queryFn: listChallenges }); }
export function useLearningArticle(id: number, enabled = true) { return useQuery({ queryKey: learningQueryKeys.article(id), queryFn: () => getArticle(id), enabled: enabled && id > 0 }); }
export function useQuizAttempt(id: number, enabled = true) { return useQuery({ queryKey: learningQueryKeys.attempt(id), queryFn: () => getQuizAttempt(id), enabled: enabled && id > 0 }); }

function createIdempotencyKey(prefix: string, id: number) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${id}:${random}`;
}

export function useStartQuizAttempt() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, idempotencyKey = createIdempotencyKey("quiz-start", quizId) }: { quizId: number; idempotencyKey?: string }) => startQuizAttempt(quizId, idempotencyKey),
    onSuccess: (data) => { void client.invalidateQueries({ queryKey: learningQueryKeys.journey() }); void client.setQueryData(learningQueryKeys.attempt(data.attempt.id), { attempt: data.attempt, result: null }); },
  });
}
export function useSubmitQuizAttempt() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ attemptId, answers }: { attemptId: number; answers: QuizAnswer[] }) => submitQuizAttempt(attemptId, answers), onSuccess: (_data, variables) => { void client.invalidateQueries({ queryKey: learningQueryKeys.attempt(variables.attemptId) }); void client.invalidateQueries({ queryKey: learningQueryKeys.journey() }); } });
}
export function useCompleteArticle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ articleId, idempotencyKey = createIdempotencyKey("article-read", articleId) }: { articleId: number; idempotencyKey?: string }) => completeArticle(articleId, idempotencyKey),
    onSuccess: (_data, variables) => { void client.invalidateQueries({ queryKey: learningQueryKeys.article(variables.articleId) }); void client.invalidateQueries({ queryKey: learningQueryKeys.recommendations() }); void client.invalidateQueries({ queryKey: learningQueryKeys.journey() }); },
  });
}
export function useJoinChallenge() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ challengeId, idempotencyKey = createIdempotencyKey("challenge", challengeId) }: { challengeId: number; idempotencyKey?: string }) => joinChallenge(challengeId, idempotencyKey), onSuccess: () => { void client.invalidateQueries({ queryKey: learningQueryKeys.challenges() }); void client.invalidateQueries({ queryKey: ["rewards"] }); void client.invalidateQueries({ queryKey: learningQueryKeys.journey() }); } });
}
