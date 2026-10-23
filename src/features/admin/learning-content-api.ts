import { apiFetch } from "../../lib/api/client";

export type AdminLearningQuiz = { id: number; title: string; category: string; difficulty: string; objective: string; versionId: number | null; version: number | null; categoryCode: string | null; level: string | null; passMark: number | null; published: boolean | null; questionCount: number; plannedQuestionCount: number };
export type AdminLearningOption = { id: number; optionKey: string; label: string; sortOrder: number; isCorrect: boolean };
export type AdminLearningQuestion = { id: number; quizVersionId: number; prompt: string; topic: string; sortOrder: number; points: number; options: AdminLearningOption[] };
export type QuestionInput = { prompt: string; topic: string; sortOrder: number; points: number; options: Array<Omit<AdminLearningOption, "id">>; reason: string };
export type QuizInput = { title: string; categoryCode: string; level: string; objective: string; passMark: number; pointsPerQuestion: number; timeLimitSeconds: number | null; questionCount: number; reason: string };
export type AdminLearningArticle = { id: number; title: string; summary: string; body: string; category: string; topic: string | null; publisher: string; difficulty: string; readingMinutes: number; publishedLabel: string | null; url: string | null; published: boolean; contentType: "internal" | "external"; categoryCode: string };
export type ArticleInput = Omit<AdminLearningArticle, "id"> & { reason: string };
type Page<T> = { items: T[]; nextAfter: number | null };
const json = (body: unknown) => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const key = (prefix: string) => `${prefix}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const audited = (body: unknown, prefix: string, idempotencyKey = key(prefix)) => ({ headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body) });

export const learningContentKeys = { quizzes: ["admin", "learning", "quizzes"] as const, questions: (id: number) => ["admin", "learning", "questions", id] as const, articles: ["admin", "learning", "articles"] as const };
export const listLearningQuizzes = (after: number | null = null) => apiFetch<Page<AdminLearningQuiz>>(`/api/admin/learning/quizzes?limit=10${after === null ? "" : `&after=${after}`}`);
export const listQuizQuestions = (versionId: number) => apiFetch<AdminLearningQuestion[]>(`/api/admin/learning/quiz-versions/${versionId}/questions`);
export const saveQuizQuestion = (versionId: number, questionId: number, input: QuestionInput, idempotencyKey?: string) => apiFetch<{ id: number; updated: boolean }>(`/api/admin/learning/quiz-versions/${versionId}/questions`, { method: "PATCH", ...audited({ ...input, questionId }, `quiz-question-update-${questionId}`, idempotencyKey) });
export const createLearningQuiz = (input: QuizInput) => apiFetch<{ id: number; versionId: number }>("/api/admin/learning/quizzes", { method: "POST", ...audited(input, "quiz-create") });
export const createLearningVersion = (quizId: number, reason: string) => apiFetch<{ id: number }>(`/api/admin/learning/quizzes/${quizId}/versions`, { method: "POST", ...audited({ reason }, "quiz-version") });
export const addLearningQuestion = (versionId: number, input: QuestionInput) => apiFetch<AdminLearningQuestion>(`/api/admin/learning/quiz-versions/${versionId}/questions`, { method: "POST", ...audited(input, "quiz-question") });
export const publishLearningVersion = (versionId: number, reason: string) => apiFetch<{ id: number }>(`/api/admin/learning/quiz-versions/${versionId}/publish`, { method: "POST", ...audited({ reason }, "quiz-publish") });
export const listLearningArticles = (after: number | null = null) => apiFetch<Page<AdminLearningArticle>>(`/api/admin/learning/articles?limit=10${after === null ? "" : `&after=${after}`}`);
export const createLearningArticle = (input: ArticleInput, idempotencyKey?: string) => apiFetch<AdminLearningArticle>("/api/admin/learning/articles", { method: "POST", ...audited(input, "article-create", idempotencyKey) });
export const updateLearningArticle = (id: number, input: ArticleInput, idempotencyKey?: string) => apiFetch<AdminLearningArticle>(`/api/admin/learning/articles/${id}`, { method: "PATCH", ...audited(input, `article-update-${id}`, idempotencyKey) });
