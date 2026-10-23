import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LearningArticle } from "../types";
import { LibraryCatalogue } from "./library-catalogue";
import { LibraryArticleBody, LibraryArticleDetail } from "./library-article-detail";

const article: LearningArticle = { id: 41, publisher: "AB Ignite Learning", title: "Letters of credit", summary: "A practical overview", category: "banking", topic: "trade-finance", difficulty: "intermediate", readingMinutes: 7, contentType: "internal", body: "## What you will learn\n\n- Explain the roles\n- Recognise discrepancies\n\n**The documentary principle.** Banks deal with documents, not goods.", sourceUrl: null };

const catalogue = (filter: "all" | "recommended" | "technology", recommendations: LearningArticle[] = []) => renderToStaticMarkup(createElement(LibraryCatalogue, { articles: [article, { ...article, id: 42, title: "Digital services", category: "technology" }], recommendedArticles: recommendations, filter, onFilterChange: () => undefined, onRead: () => undefined, onPageChange: () => undefined }));

test("library catalogue renders reference structure and filters real article props", () => {
  const all = catalogue("all", [article]);
  assert.match(all, /Library/);
  assert.match(all, /Recommended \(1\)/);
  assert.match(all, /Letters of credit/);
  assert.match(all, /Digital services/);
  assert.match(all, /Recommended for you/);
  assert.match(all, /grid.*md:grid-cols-2/);
  const technology = catalogue("technology", [article]);
  assert.doesNotMatch(technology, /Letters of credit/);
  assert.match(technology, /Digital services/);
  const recommended = catalogue("recommended", [article]);
  assert.match(recommended, /Letters of credit/);
  assert.doesNotMatch(recommended, /Digital services/);
});

test("library catalogue exposes loading, error retry and empty states", () => {
  const common = { articles: [], filter: "all" as const, onFilterChange: () => undefined, onRead: () => undefined, onPageChange: () => undefined };
  assert.match(renderToStaticMarkup(createElement(LibraryCatalogue, { ...common, loading: true })), /role="status"[^>]*>Loading the library/);
  const error = renderToStaticMarkup(createElement(LibraryCatalogue, { ...common, error: "Could not load", onRetry: () => undefined }));
  assert.match(error, /role="alert"/);
  assert.match(error, /Try again/);
  assert.match(renderToStaticMarkup(createElement(LibraryCatalogue, common)), /No published articles/);
});

test("article detail renders body typography, objectives and related quiz action", () => {
  const html = renderToStaticMarkup(createElement(LibraryArticleDetail, { article, onBack: () => undefined, onComplete: () => undefined, objectives: ["Explain the roles"], relatedQuiz: { id: 9, title: "Trade finance quiz" }, onRelatedQuiz: () => undefined }));
  assert.match(html, /Back|Library/);
  assert.match(html, /What you will learn/);
  assert.match(html, /<ul[^>]*>/);
  assert.match(html, /<strong[^>]*>The documentary principle\.<\/strong>/);
  assert.match(html, /Mark as completed/);
  assert.match(html, /Related quiz: Trade finance quiz/);
});

test("article detail renders completion, pending, error and safe body text", () => {
  const pending = renderToStaticMarkup(createElement(LibraryArticleDetail, { article, onBack: () => undefined, onComplete: () => undefined, pending: true, errorMessage: "Please retry" }));
  assert.match(pending, /disabled=""/);
  assert.match(pending, /Saving…/);
  assert.match(pending, /role="alert"/);
  const done = renderToStaticMarkup(createElement(LibraryArticleDetail, { article, onBack: () => undefined, onComplete: () => undefined, alreadyCompleted: true }));
  assert.match(done, /Already completed/);
  assert.doesNotMatch(done, /Mark as completed/);
  const safe = renderToStaticMarkup(createElement(LibraryArticleBody, { body: "<script>alert('x')</script>" }));
  assert.doesNotMatch(safe, /<script>/);
  assert.match(safe, /&lt;script&gt;/);
});

test("detail does not expose unsafe external links", () => {
  const unsafe = renderToStaticMarkup(createElement(LibraryArticleDetail, { article: { ...article, contentType: "external", sourceUrl: "https://user:secret@example.com/reading" }, onBack: () => undefined, onComplete: () => undefined }));
  assert.doesNotMatch(unsafe, /href=/);
  const safe = renderToStaticMarkup(createElement(LibraryArticleDetail, { article: { ...article, contentType: "external", sourceUrl: "https://example.com/reading" }, onBack: () => undefined, onComplete: () => undefined }));
  assert.match(safe, /href="https:\/\/example.com\/reading"/);
});
