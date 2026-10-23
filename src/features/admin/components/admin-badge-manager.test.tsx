import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBadgeManager, parseBadgeRuleForEditor } from "./admin-badge-manager";

test("badge editor accepts current and legacy rule formats and safely flags malformed rules", () => {
  assert.deepEqual(parseBadgeRuleForEditor('{"eventTypes":["idea_submission"],"minimumCount":2}'), { eventTypes: ["idea_submission"], minimumCount: 2 });
  assert.deepEqual(parseBadgeRuleForEditor('{"eventType":"idea_submitted","minimumCount":1}'), { eventTypes: ["idea_submitted"], minimumCount: 1 });
  assert.equal(parseBadgeRuleForEditor("{"), null);
  assert.equal(parseBadgeRuleForEditor('{"eventTypes":[],"minimumCount":0}'), null);
});

test("badge editor exposes a recoverable loading state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const markup = renderToStaticMarkup(<QueryClientProvider client={client}><AdminBadgeManager /></QueryClientProvider>);
  assert.match(markup, /Badge rules/);
  assert.match(markup, /Loading badge rules/);
});
