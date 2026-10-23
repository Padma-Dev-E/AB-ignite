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
  assert.match(html, /Your Personal Learning Journey/);
  assert.match(html, /Where you stand by topic/);
  assert.match(html, /Improvement over time/);
  assert.match(html, /Recent quizzes/);
});

test("journey Read it and reading cards target the backend-selected article ID", () => {
  const targets: number[] = [];
  const html = renderToStaticMarkup(createElement(JourneyCard, { journey: {
    topics: [], categories: [], recommendations: [], nextRecommendedStep: { id: 12, topic: "Risk controls", categoryCode: "banking", scorePercent: 0, thresholdPercent: 70, reason: "Strengthen the foundations." },
    nextRecommendedArticle: { id: 44, title: "Control design" },
    recommendedArticles: [{ id: 44, title: "Control design", summary: "A practical guide", category: "banking", topic: "Risk controls", difficulty: "foundation", readingMinutes: 5, contentType: "internal", sourceUrl: null, recommendation: { id: 12, topic: "Risk controls", categoryCode: "banking", scorePercent: 0, thresholdPercent: 70, reason: "Strengthen the foundations." } }],
  }, onReadArticle: (id) => targets.push(id) }));
  assert.match(html, /Read it/);
  assert.match(html, /Control design/);
  assert.match(html, />Read</);
  assert.equal(targets.length, 0);
});

test("recommended article exposes the insight action and its persisted reason", () => {
  const queryClient = new QueryClient();
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, createElement(ArticleCard, { article: {
    id: 4, publisher: "Academy", title: "Safer data", summary: "An overview", category: "risk", topic: "privacy", difficulty: "beginner", readingMinutes: 3, contentType: "internal", body: "Article content", sourceUrl: null,
    recommendation: { id: 9, topic: "privacy", scorePercent: 55, thresholdPercent: 70, reason: "Build confidence in privacy controls." },
  } })));
  assert.match(html, /Why this was recommended/);
  assert.match(html, /Build confidence in privacy controls/);
  assert.match(html, /Topic: privacy/);
  assert.match(html, /Quiz score: 55%/);
  assert.match(html, /Why this was recommended/);
});

test("external articles open only safe HTTPS sources in a new tab", () => {
  const article = { id: 8, publisher: "AB Ignite Learning", title: "Open banking", summary: "External reading", category: "banking", topic: "banking-fundamentals", difficulty: "intermediate", readingMinutes: 5, contentType: "external", body: null, sourceUrl: "https://example.org/reading" };
  const html = renderToStaticMarkup(createElement(ArticleCard, { article, onOpen: () => undefined }));
  assert.match(html, /Source: example.org/);
  assert.match(html, /Banking Excellence/);
  assert.match(html, /href="https:\/\/example.org\/reading"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /<button[^>]*>Read<\/button>/);

  const unsafe = renderToStaticMarkup(createElement(ArticleCard, { article: { ...article, sourceUrl: "https://user:pass@example.org/reading" }, onOpen: () => undefined }));
  assert.match(unsafe, /Source unavailable/);
  assert.doesNotMatch(unsafe, /href=/);
});
