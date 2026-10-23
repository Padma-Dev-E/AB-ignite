import type { QuizSummary } from "../types";

export function selectQuizPage(quizzes: QuizSummary[], category: string, level: string, page: number) {
  const available = quizzes.filter((quiz) => quiz.questionCount > 0 && (category === "all" || quiz.category === category) && (level === "all" || quiz.level === level));
  const pageCount = Math.max(1, Math.ceil(available.length / 12));
  const safePage = Number.isSafeInteger(page) ? Math.min(Math.max(page, 1), pageCount) : 1;
  return { items: available.slice((safePage - 1) * 12, safePage * 12), page: safePage, pageCount, total: available.length };
}
