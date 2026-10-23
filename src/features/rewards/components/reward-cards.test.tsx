import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BadgeProgressList,
  RedemptionHistory,
  RewardsState,
  RewardCard,
} from "./reward-cards";

test("rewards state communicates loading and retryable failures accessibly", () => {
  assert.match(
    renderToStaticMarkup(createElement(RewardsState, { state: "loading" })),
    /role="status"/,
  );
  assert.match(
    renderToStaticMarkup(
      createElement(RewardsState, { state: "error", onRetry: () => undefined }),
    ),
    /Try again/,
  );
});

test("reward cards prevent unaffordable redemption and history has an empty state", () => {
  const card = renderToStaticMarkup(
    createElement(RewardCard, {
      reward: {
        id: 7,
        name: "Coffee voucher",
        description: "A small treat",
        kind: "redeem",
        cost: 100,
        emoji: "☕",
        active: true,
      },
      balance: 20,
      onRedeem: () => undefined,
    }),
  );
  assert.match(card, /Coffee voucher/);
  assert.match(card, /disabled/);
  assert.match(
    renderToStaticMarkup(createElement(RedemptionHistory, { redemptions: [] })),
    /No redemptions yet/,
  );
});

test("redemption history visibly includes request date, reward, cost, and status", () => {
  const html = renderToStaticMarkup(
    createElement(RedemptionHistory, {
      redemptions: [
        {
          id: 12,
          userId: 1,
          rewardId: 4,
          rewardVersionId: 2,
          rewardName: "Learning day",
          rewardDescription: null,
          cost: 250,
          status: "requested",
          idempotencyKey: "key",
          requestedAt: "2026-10-22T10:30:00.000Z",
          fulfilledAt: null,
          cancelledAt: null,
          createdAt: "2026-10-22T10:30:00.000Z",
          updatedAt: "2026-10-22T10:30:00.000Z",
        },
      ],
    }),
  );
  assert.match(html, /Learning day/);
  assert.match(html, /requested/i);
  assert.match(html, /250 points/);
  assert.match(html, /Oct 22, 2026/);
});

test("redemption history exposes bounded pagination when more requests exist", () => {
  const html = renderToStaticMarkup(
    createElement(RedemptionHistory as any, {
      redemptions: [
        {
          id: 13,
          userId: 1,
          rewardId: 4,
          rewardVersionId: 2,
          rewardName: "Learning day",
          rewardDescription: null,
          cost: 250,
          status: "requested",
          idempotencyKey: "key-2",
          requestedAt: "2026-10-22T10:30:00.000Z",
          fulfilledAt: null,
          cancelledAt: null,
          createdAt: "2026-10-22T10:30:00.000Z",
          updatedAt: "2026-10-22T10:30:00.000Z",
        },
      ],
      hasNextPage: true,
      onLoadMore: () => undefined,
      isLoadingMore: false,
    }),
  );
  assert.match(html, /Load more redemptions/);
});

test("badge progress distinguishes unlocked and locked recognition", () => {
  const html = renderToStaticMarkup(
    createElement(BadgeProgressList, {
      badges: [
        {
          id: 1,
          name: "First idea",
          description: "Share your first idea.",
          awarded: { awardedAt: "2026-10-23" },
        },
        {
          id: 2,
          name: "Impact builder",
          description: "Validate benefits.",
          awarded: null,
        },
      ],
    }),
  );
  assert.match(html, /Unlocked/);
  assert.match(html, /In progress/);
  assert.match(html, /Your badges/);
});
