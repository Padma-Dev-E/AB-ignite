import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RedemptionHistory, RewardsState, RewardCard } from "./reward-cards";

test("rewards state communicates loading and retryable failures accessibly", () => {
  assert.match(renderToStaticMarkup(createElement(RewardsState, { state: "loading" })), /role="status"/);
  assert.match(renderToStaticMarkup(createElement(RewardsState, { state: "error", onRetry: () => undefined })), /Try again/);
});

test("reward cards prevent unaffordable redemption and history has an empty state", () => {
  const card = renderToStaticMarkup(createElement(RewardCard, { reward: { id: 7, name: "Coffee voucher", description: "A small treat", kind: "redeem", cost: 100, emoji: "☕", active: true }, balance: 20, onRedeem: () => undefined }));
  assert.match(card, /Coffee voucher/);
  assert.match(card, /disabled/);
  assert.match(renderToStaticMarkup(createElement(RedemptionHistory, { redemptions: [] })), /No redemptions yet/);
});
