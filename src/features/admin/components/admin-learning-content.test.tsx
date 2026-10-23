import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { learningContentKeys, type AdminLearningArticle, type AdminLearningQuiz, type QuestionInput } from "../learning-content-api";
import { AdminLearningContent, ArticleManager, nextOption, QuizManager, validLink, validQuestion } from "./admin-learning-content";

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
}
function render(queryClient: QueryClient, element: React.ReactElement) {
  return renderToStaticMarkup(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}
function quiz(id: number): AdminLearningQuiz {
  return { id, title: `Quiz ${id}`, category: "banking", difficulty: "1", objective: "Learn", versionId: id, version: 1, categoryCode: "banking", level: "beginner", passMark: 70, published: false, questionCount: 0, plannedQuestionCount: 2 };
}
function article(id: number): AdminLearningArticle {
  return { id, title: `Article ${id}`, summary: "Summary", body: "Body", category: "Banking", categoryCode: "banking", topic: null, publisher: "AB Ignite", difficulty: "Beginner", readingMinutes: 5, publishedLabel: null, url: null, published: false, contentType: "internal" };
}
const question: QuestionInput = {
  prompt: "Which answer is correct?", topic: "Banking", sortOrder: 0, points: 10, reason: "Update approved content",
  options: [
    { optionKey: "a", label: "Correct", sortOrder: 0, isCorrect: true },
    { optionKey: "b", label: "Incorrect", sortOrder: 1, isCorrect: false },
  ],
};

test("learning manager exposes keyboard-ready quiz and article tabs", () => {
  const markup = render(client(), <AdminLearningContent />);
  assert.match(markup, /role="tablist"/);
  assert.match(markup, /role="tab"/);
  assert.match(markup, /aria-selected="true"/);
  assert.match(markup, /role="tabpanel"/);
});

test("quiz and article lists render at most ten items per page", () => {
  const queryClient = client();
  queryClient.setQueryData(learningContentKeys.quizzes, { pages: [{ items: Array.from({ length: 11 }, (_, i) => quiz(i + 1)), nextAfter: 11 }], pageParams: [null] });
  queryClient.setQueryData(learningContentKeys.articles, { pages: [{ items: Array.from({ length: 11 }, (_, i) => article(i + 1)), nextAfter: 11 }], pageParams: [null] });
  const quizMarkup = render(queryClient, <QuizManager />);
  assert.match(quizMarkup, /Quiz 10/);
  assert.doesNotMatch(quizMarkup, /Quiz 11/);
  assert.match(quizMarkup, /aria-label="Quizzes pages"/);
  assert.match(quizMarkup, /\+ Create quiz/);
  assert.match(quizMarkup, />Next</);
  const articleMarkup = render(queryClient, <ArticleManager />);
  assert.match(articleMarkup, /Article 10/);
  assert.doesNotMatch(articleMarkup, /Article 11/);
  assert.match(articleMarkup, /aria-label="Articles pages"/);
  assert.match(articleMarkup, /max-h-\[28rem\].*overflow-y-auto/);
  assert.match(articleMarkup, /\+ Add article/);
  assert.doesNotMatch(articleMarkup, /Short summary/);
});

test("learning lists expose loading, empty and retry states", () => {
  assert.match(render(client(), <QuizManager />), /Loading quizzes/);
  assert.match(render(client(), <ArticleManager />), /Loading articles/);
  const emptyClient = client();
  emptyClient.setQueryData(learningContentKeys.quizzes, { pages: [{ items: [], nextAfter: null }], pageParams: [null] });
  emptyClient.setQueryData(learningContentKeys.articles, { pages: [{ items: [], nextAfter: null }], pageParams: [null] });
  assert.match(render(emptyClient, <QuizManager />), /No quizzes yet/);
  assert.match(render(emptyClient, <ArticleManager />), /No articles yet/);
  const errorClient = client();
  errorClient.getQueryCache().build(errorClient, { queryKey: learningContentKeys.quizzes, queryFn: async () => { throw new Error("Service unavailable"); } }).setState({ status: "error", error: new Error("Service unavailable"), fetchStatus: "idle" });
  assert.match(render(errorClient, <QuizManager />), /Quizzes unavailable: Service unavailable[\s\S]*Try again/);
});

test("question authoring requires unique options and exactly one correct answer", () => {
  assert.equal(validQuestion(question), true);
  assert.equal(validQuestion({ ...question, options: question.options.map((item) => ({ ...item, isCorrect: true })) }), false);
  assert.equal(validQuestion({ ...question, options: [{ ...question.options[0] }, { ...question.options[1], optionKey: "a" }] }), false);
  assert.equal(validQuestion({ ...question, options: [{ ...question.options[0] }, { ...question.options[1], sortOrder: 0 }] }), false);
  assert.equal(validQuestion({ ...question, options: [{ ...question.options[0] }, { ...question.options[1], label: " " }] }), false);
  const expanded = nextOption(question);
  assert.equal(expanded.options.length, 3);
  assert.equal(expanded.options[2].optionKey, "c");
  assert.equal(validQuestion({ ...expanded, options: expanded.options.map((item) => ({ ...item, label: item.label || "Third" })) }), true);
  let full = question;
  for (let i = 2; i < 10; i += 1) full = nextOption(full);
  assert.equal(full.options.length, 10);
  assert.equal(nextOption(full).options.length, 10);
});

test("external article controls accept only HTTPS links without credentials", () => {
  const input = { ...article(1), reason: "Publish reviewed link", contentType: "external" as const };
  assert.equal(validLink({ ...input, url: "https://example.com/learning" }), true);
  assert.equal(validLink({ ...input, url: "http://example.com/learning" }), false);
  assert.equal(validLink({ ...input, url: "https://user:secret@example.com/learning" }), false);
  assert.equal(validLink({ ...input, url: "not a url" }), false);
});
