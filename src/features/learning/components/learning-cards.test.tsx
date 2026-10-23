import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArticleCard, JourneyCard, LearningState, QuizCard } from "./learning-cards";

test("learning state renders accessible loading, error retry and empty states", () => {
  assert.match(renderToStaticMarkup(createElement(LearningState, { state: "loading", label: "Loading courses" })), /role="status"/);
  assert.match(renderToStaticMarkup(createElement(LearningState, { state: "error", label: "Could not load courses", onRetry: () => undefined })), /Try again/);
  assert.match(renderToStaticMarkup(createElement(LearningState, { state: "empty", label: "No courses yet" })), /No courses yet/);
});

test("quiz and article cards expose keyboard operable disclosure controls", () => {
  const quiz = renderToStaticMarkup(createElement(QuizCard, { quiz: { id: 1, title: "Privacy basics", category: "risk", level: "beginner", objective: "Learn privacy", passMark: 70, timeLimitSeconds: null, version: 1, questionCount: 4 }, onStart: () => undefined }));
  const article = renderToStaticMarkup(createElement(ArticleCard, { article: { id: 4, publisher: "Academy", title: "Safer data", summary: "An overview", category: "risk", topic: "privacy", difficulty: "beginner", readingMinutes: 3, contentType: "internal", body: "Article content", sourceUrl: null }, onComplete: () => undefined }));
  assert.match(quiz, /Privacy basics/);
  assert.match(quiz, /Start quiz/);
  assert.match(quiz, /button/);
  assert.match(article, /Safer data/);
  assert.match(article, /Mark as read/);
});

test("journey visualizes topic trend and category performance accessibly", () => {
  const html = renderToStaticMarkup(createElement(JourneyCard, { journey: {
    topics: [{ topic: "Privacy", categoryCode: "risk", scorePercent: 65, trend: [40, 55, 65] }],
    categories: [{ categoryCode: "risk", scorePercent: 65, correctCount: 13, totalQuestions: 20 }],
    recommendations: [], nextRecommendedStep: null,
  } }));
  assert.match(html, /Privacy/);
  assert.match(html, /65%/);
  assert.match(html, /progressbar/);
  assert.match(html, /Attempt trend/);
});

test("recommended article exposes the insight action and its persisted reason", () => {
  const queryClient = new QueryClient();
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, createElement(ArticleCard, { article: {
    id: 4, publisher: "Academy", title: "Safer data", summary: "An overview", category: "risk", topic: "privacy", difficulty: "beginner", readingMinutes: 3, contentType: "internal", body: "Article content", sourceUrl: null,
    recommendation: { id: 9, topic: "privacy", scorePercent: 55, thresholdPercent: 70, reason: "Build confidence in privacy controls." },
  } })));
  assert.match(html, /Why this was recommended/);
  assert.match(html, /Build confidence in privacy controls/);
  assert.match(html, /Why this was recommended/);
});
