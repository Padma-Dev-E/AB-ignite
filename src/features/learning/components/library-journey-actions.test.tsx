import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LearningJourney } from "../types";
import { JourneyCard } from "./learning-cards";

const journey: LearningJourney = {
  topics: [], categories: [], recommendations: [], nextRecommendedStep: null,
  recommendedArticles: [{ id: 44, title: "Control design", summary: "A practical guide", category: "banking", topic: "risk-controls", difficulty: "foundation", readingMinutes: 5, contentType: "internal", sourceUrl: null, relatedQuizId: 19, recommendation: { id: 12, topic: "risk-controls", categoryCode: "banking", scorePercent: 40, thresholdPercent: 70, reason: "Strengthen controls." } } as NonNullable<LearningJourney["recommendedArticles"]>[number]],
};

function buttonActions(node: unknown): Array<{ label: string; onClick?: () => void }> {
  if (Array.isArray(node)) return node.flatMap(buttonActions);
  if (!React.isValidElement(node)) return [];
  const element = node as React.ReactElement<{ children?: React.ReactNode; onClick?: () => void }>;
  const children = buttonActions(element.props.children);
  return element.type === "button" ? [{ label: renderToStaticMarkup(element), onClick: element.props.onClick }, ...children] : children;
}

test("journey recommended actions pass exact article and backend quiz IDs", () => {
  const calls: string[] = [];
  const buttons = buttonActions(JourneyCard({ journey, onReadArticle: (id) => calls.push(`read:${id}`), onCompleteArticle: (id) => calls.push(`complete:${id}`), onRetakeRelatedQuiz: (articleId, quizId) => calls.push(`quiz:${articleId}:${quizId}`) }));
  buttons.find((button) => button.label.includes(">Read</"))?.onClick?.();
  buttons.find((button) => button.label.includes("Mark as completed"))?.onClick?.();
  buttons.find((button) => button.label.includes("Retake a related quiz"))?.onClick?.();
  assert.deepEqual(calls, ["read:44", "complete:44", "quiz:44:19"]);
});

test("journey shows pending, completed and per-article error states", () => {
  const props = { journey, onReadArticle: () => undefined, onCompleteArticle: () => undefined, onRetakeRelatedQuiz: () => undefined };
  const pending = renderToStaticMarkup(React.createElement(JourneyCard, { ...props, pendingArticleId: 44, pendingQuizArticleId: 44, articleErrors: { 44: "Please retry" } }));
  assert.match(pending, /Saving…/);
  assert.match(pending, /Opening quiz…/);
  assert.match(pending, /role="alert"/);
  assert.match(pending, /Please retry/);
  const completed = renderToStaticMarkup(React.createElement(JourneyCard, { ...props, alreadyCompletedArticleIds: [44] }));
  assert.match(completed, /✓ Completed/);
  assert.doesNotMatch(completed, /Mark as completed/);
});
