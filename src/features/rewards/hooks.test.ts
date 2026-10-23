import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { refreshEmployeeRewards, rewardsQueryKeys } from "./hooks";

test("employee reward refresh invalidates points, level, and badge summary", async () => {
  const client = new QueryClient();
  client.setQueryData(rewardsQueryKeys.summary(), { balance: { balance: 10 }, level: null, badges: [] });

  await refreshEmployeeRewards(client);

  assert.equal(client.getQueryState(rewardsQueryKeys.summary())?.isInvalidated, true);
  client.clear();
});
