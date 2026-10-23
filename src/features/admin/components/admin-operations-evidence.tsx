"use client";

import { useMemo } from "react";
import { Card, SectionHeading, StatTile } from "../../../components/ui";
import { useAdminAnalytics, useAdminAudit, useAdminChallenges, useAdminFeedback, useAdminRedemptions, useAdminScreening, useAdminTransformation, useAdminUsers } from "../hooks";
import { adminExportUrl } from "../api";
import { AdminFeedbackResponses } from "./admin-feedback-responses";

type EvidenceRow = { area: string; metric: string; value: number; scope: string };

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadCsv(rows: EvidenceRow[]) {
  const csv = [
    ["area", "metric", "value", "scope"].map(csvCell).join(","),
    ...rows.map((row) => [row.area, row.metric, row.value, row.scope].map(csvCell).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ab-ignite-admin-summary-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function State({ label, pending, error, count }: { label: string; pending: boolean; error: boolean; count: number | undefined }) {
  if (pending) return <span className="text-sm text-muted" role="status">Loading {label}…</span>;
  if (error) return <span className="text-sm text-pink" role="alert">{label} unavailable</span>;
  return <span className="text-sm text-muted">{count ?? 0} records in the bounded view</span>;
}

/** Standalone admin evidence surface. Data is limited to existing secured read endpoints. */
export function AdminOperationsEvidence() {
  const users = useAdminUsers();
  const analytics = useAdminAnalytics();
  const audit = useAdminAudit();
  const screening = useAdminScreening();
  const transformation = useAdminTransformation();
  const challenges = useAdminChallenges();
  const redemptions = useAdminRedemptions();
  const feedback = useAdminFeedback();

  const rows = useMemo<EvidenceRow[]>(() => [
    { area: "people", metric: "users_returned", value: users.data?.items.length ?? 0, scope: "first 50 users from secured admin directory endpoint" },
    { area: "audit", metric: "events_returned", value: audit.data?.items.length ?? 0, scope: "first 50 events from secured admin audit endpoint" },
    { area: "governance", metric: "screening_items", value: screening.data?.items.length ?? 0, scope: "first 50 screening records" },
    { area: "governance", metric: "transformation_items", value: transformation.data?.items.length ?? 0, scope: "first 50 transformation records" },
    { area: "learning", metric: "open_challenges", value: challenges.data?.items.length ?? 0, scope: "currently active challenges visible to the signed-in admin" },
    { area: "rewards", metric: "redemptions_returned", value: redemptions.data?.items.length ?? 0, scope: "current secured admin redemption page" },
    { area: "engagement", metric: "feedback_responses", value: feedback.data?.items.length ?? 0, scope: "up to 100 secured admin feedback responses" },
  ], [users.data, audit.data, screening.data, transformation.data, challenges.data, redemptions.data, feedback.data]);

  const ready = [users, audit, screening, transformation, challenges, redemptions, feedback].every((query) => query.isSuccess);
  const refresh = () => void Promise.all([users.refetch(), audit.refetch(), screening.refetch(), transformation.refetch(), challenges.refetch(), redemptions.refetch(), feedback.refetch()]);

  return <div className="stack">
    <SectionHeading title="Operations evidence" detail="Bounded, read-only operational summaries and controlled exports" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile value={users.data?.items.length ?? "—"} label="Users in view" />
      <StatTile value={screening.data?.items.length ?? "—"} label="Screening items" />
      <StatTile value={challenges.data?.items.length ?? "—"} label="Open challenges" />
      <StatTile value={audit.data?.items.length ?? "—"} label="Audit events in view" />
    </div>
    {analytics.data && <Card><h2 className="text-xl font-medium">30 day analytics</h2><p className="mt-1 text-xs text-muted">Generated {new Date(analytics.data.generatedAt).toLocaleString()}</p><div className="mt-3 flex flex-wrap gap-2">{analytics.data.usersByState.map((item) => <span className="pill" key={item.state}>{item.state}: {item.count}</span>)}{analytics.data.auditByAction.map((item) => <span className="pill" key={item.action}>{item.action}: {item.count}</span>)}</div></Card>}
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-xl font-medium">Evidence exports</h2><p className="mt-1 max-w-2xl text-sm text-muted">The summary CSV contains aggregate counts and scope labels only. The audit CSV uses the existing audited, bounded server export.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={refresh}>Refresh evidence</button>
          <button type="button" className="btn-primary" disabled={!ready} onClick={() => downloadCsv(rows)}>Download summary CSV</button>
          <a className="btn" href={adminExportUrl("audit")}>Download audit CSV</a>
          <a className="btn" href={adminExportUrl("users")}>Download users CSV</a>
        </div>
      </div>
      {!ready && <p className="mt-3 text-xs text-muted">Summary export becomes available after all bounded source queries load successfully.</p>}
      <div className="mt-5 divide-y" style={{ borderColor: "var(--line)" }}>
        <div className="grid gap-2 py-3 text-xs font-medium uppercase tracking-wide text-muted sm:grid-cols-[1fr_2fr]"><span>Source</span><span>Available evidence</span></div>
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_2fr]"><b className="font-medium">People directory</b><State label="users" pending={users.isPending} error={users.isError} count={users.data?.items.length} /></div>
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_2fr]"><b className="font-medium">Audit log</b><State label="audit events" pending={audit.isPending} error={audit.isError} count={audit.data?.items.length} /></div>
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_2fr]"><b className="font-medium">Idea governance</b><span className="text-sm text-muted">{screening.isError || transformation.isError ? "Governance queue unavailable" : screening.isPending || transformation.isPending ? "Loading queues…" : `${screening.data?.items.length ?? 0} screening · ${transformation.data?.items.length ?? 0} transformation`}</span></div>
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_2fr]"><b className="font-medium">Learning challenges</b><State label="challenges" pending={challenges.isPending} error={challenges.isError} count={challenges.data?.items.length} /></div>
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_2fr]"><b className="font-medium">Reward redemptions</b><State label="redemptions" pending={redemptions.isPending} error={redemptions.isError} count={redemptions.data?.items.length} /></div>
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_2fr]"><b className="font-medium">Feedback campaigns</b><State label="feedback" pending={feedback.isPending} error={feedback.isError} count={feedback.data?.items.length} /></div>
      </div>
    </Card>
    <Card>
      <h2 className="text-xl font-medium">Challenge and campaign operations</h2>
      <p className="mt-1 text-sm text-muted">Challenges are currently view-only. Campaign feedback can be reviewed and answered using the existing secured response workflow.</p>
      {challenges.isPending ? <p className="mt-4 text-sm text-muted" role="status">Loading challenges…</p> : challenges.isError ? <p className="mt-4 text-sm text-pink" role="alert">Challenge list is unavailable.</p> : <div className="mt-4 space-y-2">{challenges.data?.items.length ? challenges.data.items.map((challenge) => <article key={challenge.id} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{challenge.title}</h3><span className="pill">{challenge.participants} participants · {challenge.points} points</span></div><p className="mt-1 text-sm text-muted">{challenge.question}</p><p className="mt-2 text-xs text-muted">Closes {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(challenge.deadlineAt))}</p></article>) : <p className="text-sm text-muted">No active challenges are available.</p>}</div>}
      <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--line)" }}><AdminFeedbackResponses /></div>
      <div className="mt-5 rounded-xl border border-dashed p-4" style={{ borderColor: "var(--line-strong)" }}><h3 className="font-medium">Announcements</h3><p className="mt-1 text-sm text-muted">No secured admin announcement list or management endpoint is present. This control is unavailable until a bank-authorized endpoint exists.</p></div>
    </Card>
  </div>;
}
