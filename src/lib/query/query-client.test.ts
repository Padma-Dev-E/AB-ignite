import assert from "node:assert/strict";
import test from "node:test";
import { createQueryClient } from "./query-client";
import { ApiError } from "../api/client";

test("query factories isolate server-render caches", () => {
  const first = createQueryClient();
  const second = createQueryClient();
  first.setQueryData(["private"], { owner: "first" });
  assert.equal(second.getQueryData(["private"]), undefined);
  first.clear();
  second.clear();
});

test("does not retry authorization failures or mutations; bounds transient retries", async () => {
  const client = createQueryClient();
  let calls = 0;
  await assert.rejects(client.fetchQuery({ queryKey: ["private"], queryFn: async () => {
    calls++;
    throw new ApiError("forbidden", "Denied", 403, "req-1");
  } }));
  assert.equal(calls, 1);
  const retry = client.getDefaultOptions().queries?.retry;
  assert.equal(typeof retry, "function");
  if (typeof retry === "function") {
    assert.equal(retry(0, new Error("network")), true);
    assert.equal(retry(2, new Error("network")), false);
    assert.equal(retry(0, new ApiError("validation_error", "Invalid", 400)), false);
  }
  assert.equal(client.getDefaultOptions().mutations?.retry, false);
  client.clear();
});
