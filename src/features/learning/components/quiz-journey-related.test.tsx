import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuizJourney } from "./quiz-journey";
import { learningQueryKeys } from "../hooks";

test("related quiz opens its detail and start entry from the visible catalogue", () => {
  const client = new QueryClient();
  client.setQueryData(learningQueryKeys.quizzes(), { items: [{ id: 42, title: "Banking controls", category: "banking", level: "beginner", objective: "Learn controls", passMark: 70, timeLimitSeconds: 300, version: 1, questionCount: 3 }] });
  const render = (id: number) => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(QuizJourney, { relatedQuizId: id })));
  const detail = render(42);
  assert.match(detail, /Banking controls/);
  assert.match(detail, /Start quiz/);
  assert.match(detail, /Back to all quizzes/);
  const unavailable = render(99);
  assert.match(unavailable, /no longer available/);
  assert.doesNotMatch(unavailable, /Start quiz/);
});

test("catalogue and related detail label completed quizzes Retake without auto-starting", () => {
  const client = new QueryClient();
  client.setQueryData(learningQueryKeys.quizzes(), { items: [{ id: 7, title: "Controls", category: "banking", level: "beginner", objective: "Learn controls", passMark: 70, timeLimitSeconds: null, version: 1, questionCount: 3, hasAttempted: true }] });
  const render = (relatedQuizId?: number) => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(QuizJourney, { relatedQuizId })));
  assert.match(render(), /Retake quiz/);
  const detail = render(7);
  assert.match(detail, /Retake quiz/);
  assert.match(detail, /Back to all quizzes/);
  assert.doesNotMatch(detail, /Question 1 of/);
});
