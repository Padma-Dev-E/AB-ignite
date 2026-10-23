import assert from "node:assert/strict";
import test from "node:test";
import { selectQuizPage } from "./quiz-catalogue";
import type { QuizSummary } from "../types";

const quizzes: QuizSummary[] = Array.from({ length: 15 }, (_, index) => ({
  id: index + 1, title: `Quiz ${index + 1}`, category: index < 10 ? "banking" : "technology",
  level: index % 2 ? "advanced" : "beginner", objective: "Learn", passMark: 70,
  timeLimitSeconds: 300, version: 1, questionCount: 3,
}));

test("catalogue bounds a long published list to twelve usable quizzes per page", () => {
  const result = selectQuizPage([...quizzes, { ...quizzes[0], id: 99, questionCount: 0 }], "all", "all", 1);
  assert.equal(result.items.length, 12);
  assert.deepEqual(result.items.map((item) => item.id), Array.from({ length: 12 }, (_, index) => index + 1));
  assert.equal(result.total, 15);
  assert.equal(result.pageCount, 2);
  assert.deepEqual(selectQuizPage(quizzes, "all", "all", 2).items.map((item) => item.id), [13, 14, 15]);
});

test("category and level filters narrow the catalogue and clamp stale page numbers", () => {
  const result = selectQuizPage(quizzes, "technology", "advanced", 9);
  assert.deepEqual(result.items.map((item) => item.id), [12, 14]);
  assert.equal(result.page, 1);
  assert.equal(result.pageCount, 1);
});
