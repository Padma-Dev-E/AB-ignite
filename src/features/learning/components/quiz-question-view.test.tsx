import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizQuestionView, QuizResult } from "./quiz-journey";
import type { QuizQuestion, QuizResult as QuizResultData } from "../types";

const question: QuizQuestion = { id: 1, topic: "Banking", prompt: "Which control is correct?", sortOrder: 0, points: 10, options: [{ id: 2, optionKey: "a", label: "Documented control", sortOrder: 0 }] };
const callbacks = { onSelect: () => {}, onPrevious: () => {}, onNext: () => {}, onSubmit: () => {} };

test("an offline quiz preserves the question and disables submission until reconnection", () => {
  const html = renderToStaticMarkup(createElement(QuizQuestionView, { question, index: 0, count: 1, selected: "a", remaining: 45, submitting: false, online: false, ...callbacks }));
  assert.match(html, /Which control is correct\?/);
  assert.match(html, /Connection lost\. Your answers are saved on this tab/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Finish quiz<\/button>/);
});

test("a paused submission tells the user it resumes after reconnect", () => {
  const html = renderToStaticMarkup(createElement(QuizQuestionView, { question, index: 0, count: 1, selected: "a", remaining: 45, submitting: true, online: false, ...callbacks }));
  assert.match(html, /Submission will continue when the connection returns/);
  assert.match(html, /Waiting for connection…/);
});

test("an expired attempt keeps retry available after the connection returns", () => {
  const html = renderToStaticMarkup(createElement(QuizQuestionView, { question, index: 0, count: 1, selected: "a", remaining: 0, submitting: false, online: true, submitError: "Network unavailable", ...callbacks }));
  assert.match(html, /Time is up\. Submit the attempt/);
  assert.match(html, /Network unavailable/);
  assert.match(html, /<button[^>]*>Submit expired attempt<\/button>/);
});

test("result comparison labels the score delta in percentage points", () => {
  const result: QuizResultData = { attemptId: 1, status: "submitted", scorePercent: 0, passed: false, passMark: 70, correctCount: 0, totalQuestions: 3, pointsAwarded: 0, firstAttempt: false, previousScorePercent: 100, pointsStatus: "not_applicable", submittedAt: null };
  const html = renderToStaticMarkup(createElement(QuizResult, { result, onReplay: () => undefined }));
  assert.match(html, /-100 percentage points/);
});
