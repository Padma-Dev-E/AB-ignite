import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BadgeProgressList, RewardsState, RewardCard } from "./reward-cards";

test("rewards state communicates loading and retryable failures accessibly", () => {
  assert.match(renderToStaticMarkup(createElement(RewardsState, { state: "loading" })), /role="status"/);
  assert.match(renderToStaticMarkup(createElement(RewardsState, { state: "error", onRetry: () => undefined })), /Try again/);
});

test("catalogue reward cards display recognition details without redemption actions", () => {
  const html = renderToStaticMarkup(createElement(RewardCard, {
    reward: { id: 7, name: "Coffee voucher", description: "A small treat", kind: "catalogue", cost: 100, emoji: "☕", active: true },
  }));
  assert.match(html, /Coffee voucher/);
  assert.match(html, /Recognition value: 100 points/);
  assert.doesNotMatch(html, /Redeem|Request reward/);
});

test("badge progress distinguishes unlocked and locked recognition", () => {
  const html = renderToStaticMarkup(createElement(BadgeProgressList, { badges: [
    { id: 1, name: "First idea", description: "Share your first idea.", awarded: { awardedAt: "2026-10-23" } },
    { id: 2, name: "Impact builder", description: "Validate benefits.", awarded: null },
  ] }));
  assert.match(html, /Unlocked/);
  assert.match(html, /In progress/);
  assert.match(html, /Your badges/);
});
