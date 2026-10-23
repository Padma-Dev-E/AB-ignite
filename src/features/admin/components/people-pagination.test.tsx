import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { peopleQueryKeys } from "../people-api";
import type { AdminUser } from "../types";
import { AdminPeopleManagement } from "./admin-people-management";
import { PeoplePagination } from "./people-pagination";

function client() { return new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } }); }
function render(queryClient: QueryClient) { return renderToStaticMarkup(<QueryClientProvider client={queryClient}><AdminPeopleManagement currentUserId={1} /></QueryClientProvider>); }
function user(id: number): AdminUser { return { id, name: `Employee ${id}`, email: `employee${id}@example.test`, role: "employee", department: "Operations", jobTitle: null, isActive: true, failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null, lastSeenAt: null, deactivatedAt: null, createdAt: "2026-01-01T00:00:00.000Z" }; }

test("People shows only the first ten records even when later cursor pages are cached", () => {
  const queryClient = client();
  queryClient.setQueryData(peopleQueryKeys.search(""), { pages: [{ items: Array.from({ length: 11 }, (_, index) => user(index + 1)), nextAfter: 11 }, { items: [user(12)], nextAfter: null }], pageParams: [null, 11] });
  const markup = render(queryClient);
  assert.match(markup, /Employee 10/);
  assert.doesNotMatch(markup, /Employee 11/);
  assert.doesNotMatch(markup, /Employee 12/);
  assert.match(markup, /aria-label="People pages"/);
  assert.match(markup, /Page 1 · 10 per page/);
  assert.match(markup, />Next</);
  assert.doesNotMatch(markup, /Load more people/);
  queryClient.clear();
});

test("People distinguishes empty and initial loading states", () => {
  const emptyClient = client();
  emptyClient.setQueryData(peopleQueryKeys.search(""), { pages: [{ items: [], nextAfter: null }], pageParams: [null] });
  assert.match(render(emptyClient), /No users found/);
  assert.match(render(client()), /Loading people/);
  emptyClient.clear();
});

test("shared page controls disable unavailable navigation", () => {
  const markup = renderToStaticMarkup(<PeoplePagination label="Sessions" page={1} hasNext={false} onPrevious={() => undefined} onNext={() => undefined} />);
  assert.match(markup, /aria-label="Sessions pages"/);
  assert.match(markup, /disabled=""[^>]*>Previous/);
  assert.match(markup, /disabled=""[^>]*>Next/);
});
