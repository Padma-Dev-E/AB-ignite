import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { refreshEmployeeRewards, rewardsQueryKeys } from "./hooks";

test("employee reward refresh invalidates balance, level, badges, and redemption history", async () => {
  const client = new QueryClient();
  client.setQueryData(rewardsQueryKeys.summary(), { balance: { balance: 10 }, level: null, badges: [] });
  client.setQueryData(rewardsQueryKeys.redemptions(), { items: [] });

  await refreshEmployeeRewards(client);

  assert.equal(client.getQueryState(rewardsQueryKeys.summary())?.isInvalidated, true);
  assert.equal(client.getQueryState(rewardsQueryKeys.redemptions())?.isInvalidated, true);
  client.clear();
});
