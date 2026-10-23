import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { adminQueryKeys } from "../api";
import { adminEngagementKeys } from "../engagement-api";
import { adminBadgeQueryKey } from "../badge-api";
import { AdminEngagementManager } from "./admin-engagement-manager";
import { AdminEvaluation } from "./admin-evaluation";
import { AdminBadgeManager } from "./admin-badge-manager";
import { AdminFeedbackResponses } from "./admin-feedback-responses";
import { AdminRewardCatalogueManager, rewardCatalogueUrl } from "./admin-reward-catalogue-manager";

function render(client: QueryClient, element: React.ReactElement) {
  return renderToStaticMarkup(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
function client() { return new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } }); }

test("engagement lists expose next pages after ten records", () => {
  const queryClient = client();
  queryClient.setQueryData([...adminEngagementKeys.announcements, 1], { items: Array.from({ length: 11 }, (_, index) => ({ id: index + 1, title: `Announcement ${index + 1}`, body: "Message", pinned: false, published: true })), page: 1, pageSize: 10, total: 11, totalPages: 2 });
  queryClient.setQueryData([...adminEngagementKeys.campaigns, 1], { items: Array.from({ length: 10 }, (_, index) => ({ id: index + 1, title: `Campaign ${index + 1}`, description: null, active: true, pinned: false, endsAt: null })), page: 1, pageSize: 10, total: 11, totalPages: 2 });
  queryClient.setQueryData([...adminEngagementKeys.challenges, null], { items: Array.from({ length: 10 }, (_, index) => ({ id: index + 1, title: `Challenge ${index + 1}`, question: "How?", deadlineAt: "2030-01-01T00:00:00.000Z", active: true, points: 5 })), nextAfter: 10 });
  const markup = render(queryClient, <AdminEngagementManager />);
  assert.match(markup, /Announcement 10/);
  assert.doesNotMatch(markup, /Announcement 11/);
  assert.match(markup, /aria-label="Announcements pages"/);
  assert.match(markup, /max-h-\[36rem\]/);
  assert.match(markup, /Campaign 10/);
  assert.match(markup, /aria-label="Campaigns pages"/);
  assert.match(markup, /Challenge 10/);
  assert.match(markup, /aria-label="Challenges pages"/);
  assert.match(markup, />Next</);
});

test("feedback preserves access to more responses after the first ten", () => {
  const queryClient = client();
  const data = { items: Array.from({ length: 11 }, (_, index) => ({ id: index + 1, campaignId: 1, userId: index + 1, userName: `Employee ${index + 1}`, category: "General", message: `Response ${index + 1}`, response: null, createdAt: "2026-10-01T00:00:00.000Z", respondedAt: null })), nextAfter: 10 };
  queryClient.setQueryData(adminQueryKeys.feedback, data);
  queryClient.setQueryData([...adminQueryKeys.feedback, null], data);
  const markup = render(queryClient, <AdminFeedbackResponses />);
  assert.match(markup, /Response 10/);
  assert.doesNotMatch(markup, /Response 11/);
  assert.match(markup, /aria-label="Campaign feedback pages"/);
  assert.match(markup, /max-h-\[40rem\]/);
  assert.match(markup, />Next</);
});

test("routed evaluation queue exposes its next cursor after ten ideas", () => {
  const queryClient = client();
  const data = { items: Array.from({ length: 11 }, (_, index) => ({ id: index + 1, reference: `IDEA-${index + 1}`, title: `Idea ${index + 1}`, summary: "Summary", category: "Improvement", status: "routed", priorityBand: null, priorityScore: null, authorId: 1, authorName: "Employee", department: "Operations", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" })), nextAfter: 10 };
  queryClient.setQueryData(adminQueryKeys.evaluations, data);
  queryClient.setQueryData([...adminQueryKeys.evaluations, null], data);
  const markup = render(queryClient, <AdminEvaluation />);
  assert.match(markup, /Idea 10/);
  assert.doesNotMatch(markup, /Idea 11/);
  assert.match(markup, /aria-label="Routed evaluations pages"/);
  assert.match(markup, />Next</);
});

test("badge rules never render more than ten rows", () => {
  const queryClient = client();
  queryClient.setQueryData([...adminBadgeQueryKey, null], { items: Array.from({ length: 11 }, (_, index) => ({ id: index + 1, code: `badge-${index + 1}`, name: `Badge ${index + 1}`, description: "Milestone", ruleJson: '{"eventTypes":["idea_submission"],"minimumCount":1}', active: true, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" })), nextAfter: 10, availableEvents: [{ code: "idea_submission", name: "Idea submitted", active: true }] });
  const badges = render(queryClient, <AdminBadgeManager />);
  assert.match(badges, /Badge 10/);
  assert.doesNotMatch(badges, /Badge 11/);
  assert.match(badges, />Next</);
});

test("reward catalogue requests ten-row pages and bounds the visible table", () => {
  const url = new URL(rewardCatalogueUrl(2), "http://localhost");
  assert.equal(url.pathname, "/api/admin/rewards");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("pageSize"), "10");
  assert.equal(new URL(rewardCatalogueUrl(0), "http://localhost").searchParams.get("page"), "1");
  const queryClient = client();
  queryClient.setQueryData([...adminQueryKeys.rewards, { page: 1 }], {
    items: Array.from({ length: 11 }, (_, index) => ({ id: index + 1, name: `Catalogue reward ${index + 1}`, description: "Reward description", kind: "catalogue", cost: 10, emoji: null, active: true })),
    page: 1, pageSize: 10, total: 11, totalPages: 2,
  });
  const markup = render(queryClient, <AdminRewardCatalogueManager />);
  assert.match(markup, /Catalogue reward 10/);
  assert.doesNotMatch(markup, /Catalogue reward 11/);
  assert.match(markup, /aria-label="Reward catalogue pages"/);
  assert.match(markup, /Page 1 of 2/);
  assert.match(markup, />Next</);
  assert.match(markup, />Edit</);
  assert.match(markup, /max-h-\[36rem\]/);
});

test("engagement and feedback lists show loading and empty states", () => {
  const loading = client();
  assert.match(render(loading, <AdminEngagementManager />), /Loading…/);
  assert.match(render(loading, <AdminFeedbackResponses />), /Loading campaign feedback/);

  const empty = client();
  empty.setQueryData([...adminEngagementKeys.announcements, 1], { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  empty.setQueryData([...adminEngagementKeys.campaigns, 1], { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  empty.setQueryData([...adminEngagementKeys.challenges, null], { items: [], nextAfter: null });
  empty.setQueryData([...adminQueryKeys.feedback, null], { items: [], nextAfter: null });
  const engagement = render(empty, <AdminEngagementManager />);
  assert.match(engagement, /No announcements yet/);
  assert.match(engagement, /No campaigns yet/);
  assert.match(engagement, /No challenges yet/);
  assert.match(render(empty, <AdminFeedbackResponses />), /There are no campaign responses yet/);
});

test("engagement and feedback list failures offer retry", () => {
  const failed = client();
  failed.getQueryCache().build(failed, { queryKey: [...adminEngagementKeys.announcements, 1], queryFn: async () => { throw new Error("Announcements unavailable"); } }).setState({ status: "error", error: new Error("Announcements unavailable"), fetchStatus: "idle" });
  failed.getQueryCache().build(failed, { queryKey: [...adminQueryKeys.feedback, null], queryFn: async () => { throw new Error("Feedback unavailable"); } }).setState({ status: "error", error: new Error("Feedback unavailable"), fetchStatus: "idle" });
  assert.match(render(failed, <AdminEngagementManager />), /Announcements unavailable[\s\S]*Try again/);
  assert.match(render(failed, <AdminFeedbackResponses />), /Feedback unavailable[\s\S]*Try again/);
});

test("reward catalogue distinguishes loading, failure, and empty states", () => {
  assert.match(render(client(), <AdminRewardCatalogueManager />), /Loading reward catalogue/);
  const failed = client();
  failed.getQueryCache().build(failed, { queryKey: [...adminQueryKeys.rewards, { page: 1 }], queryFn: async () => { throw new Error("Catalogue offline"); } }).setState({ status: "error", error: new Error("Catalogue offline"), fetchStatus: "idle" });
  assert.match(render(failed, <AdminRewardCatalogueManager />), /Catalogue unavailable:[\s\S]*Catalogue offline[\s\S]*Try again/);
  const empty = client();
  empty.setQueryData([...adminQueryKeys.rewards, { page: 1 }], { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
  assert.match(render(empty, <AdminRewardCatalogueManager />), /No rewards exist yet/);
});

test("feedback and evaluation lists keep loading and retry states visible", () => {
  const loadingFeedback = render(client(), <AdminFeedbackResponses />);
  const loadingEvaluations = render(client(), <AdminEvaluation />);
  assert.match(loadingFeedback, /Loading campaign feedback/);
  assert.match(loadingEvaluations, /Loading routed evaluations/);

  const feedbackClient = client();
  feedbackClient.getQueryCache().build(feedbackClient, { queryKey: [...adminQueryKeys.feedback, null], queryFn: async () => { throw new Error("Feedback unavailable"); } }).setState({ status: "error", error: new Error("Feedback unavailable"), fetchStatus: "idle" });
  const evaluationClient = client();
  evaluationClient.getQueryCache().build(evaluationClient, { queryKey: [...adminQueryKeys.evaluations, null], queryFn: async () => { throw new Error("Evaluations unavailable"); } }).setState({ status: "error", error: new Error("Evaluations unavailable"), fetchStatus: "idle" });
  assert.match(render(feedbackClient, <AdminFeedbackResponses />), /Feedback unavailable[\s\S]*Try again/);
  assert.match(render(evaluationClient, <AdminEvaluation />), /Evaluations unavailable[\s\S]*Try again/);
});
