"use client";

import React, { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, SectionHeading, StatTile } from "../../../components/ui";
import { CAPABILITIES, hasCapability } from "../../../lib/auth/permissions";
import { useAdminAnalytics, useAdminAudit, useAdminChallenges, useAdminFeedback, useAdminScreening, useAdminTransformation, useAdminUsers } from "../hooks";
import { adminExportUrl } from "../api";
import { AdminFeedbackResponses } from "./admin-feedback-responses";

type EvidenceRow = { area: string; metric: string; value: number; scope: string };

function csvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
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

type Analytics = NonNullable<ReturnType<typeof useAdminAnalytics>["data"]>;

function MetricList({ title, items, empty }: { title: string; items: Array<{ label: string; count: number }>; empty: string }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / 10));
  const visiblePage = Math.min(page, pages - 1);
  return <Card>
    <h3 className="text-lg font-medium">{title}</h3>
    {items.length ? <ul className="mt-3 divide-y divide-[var(--line)]">{items.slice(visiblePage * 10, visiblePage * 10 + 10).map(item => <li key={item.label} className="flex justify-between gap-3 py-2 text-sm"><span>{item.label}</span><strong>{item.count.toLocaleString()}</strong></li>)}</ul> : <p className="mt-3 text-sm text-muted">{empty}</p>}
    {pages > 1 && <nav aria-label={`${title} pages`} className="mt-4 flex items-center justify-between gap-2 text-sm"><button type="button" className="btn btn-small" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Previous</button><span>Page {visiblePage + 1} of {pages}</span><button type="button" className="btn btn-small" disabled={visiblePage + 1 >= pages} onClick={() => setPage(visiblePage + 1)}>Next</button></nav>}
  </Card>;
}

export function OperationsAnalytics({ data }: { data: Analytics }) {
  return <section aria-label="Operations evidence" className="space-y-4">
    <div><h2 className="text-xl font-medium">Operations evidence</h2><p className="mt-1 text-sm text-muted">Current platform totals, generated {new Date(data.generatedAt).toLocaleString()}.</p></div>
    <div className="grid gap-3 lg:grid-cols-3">
      <MetricList title="Idea status" items={data.ideasByStatus.map(item => ({ label: item.status.replaceAll("_", " "), count: item.count }))} empty="No ideas in this group yet." />
      <MetricList title="Priority bands" items={data.ideasByPriority.map(item => ({ label: item.band ?? "Unassigned", count: item.count }))} empty="No ideas in this group yet." />
      <MetricList title="Ideas by department" items={data.ideasByDepartment.map(item => ({ label: item.department, count: item.count }))} empty="No department counts yet." />
      <MetricList title="Users by department" items={data.usersByDepartment.map(item => ({ label: item.department, count: item.count }))} empty="No department counts yet." />
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile value={data.points.total} label="Points ledger total" />
      <StatTile value={data.learning.quizAttempts} label="Quiz attempts" />
      <StatTile value={data.learning.publishedArticles} label="Published articles" />
      <StatTile value={data.learning.articleCompletions} label="Article completions" />
    </div>
    <p className="text-xs text-muted">Points cover all ledger entries. Learning counts cover all attempts and recorded completions; published articles reflect the current catalogue.</p>
  </section>;
}

export function auditExportUrl(filters: Record<string, string> = {}, after: number | null = null) {
  const params = new URLSearchParams({ limit: "1000" });
  for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
  if (after !== null) params.set("after", String(after));
  return `/api/admin/audit/export?${params}`;
}

export async function fetchAuditExportPart(url: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(url, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(`Audit CSV download failed (${response.status}).`);
  const cursor = response.headers.get("x-next-after");
  if (cursor !== null && (!/^[1-9]\d*$/.test(cursor) || !Number.isSafeInteger(Number(cursor)))) throw new Error("Audit CSV returned an invalid continuation cursor.");
  return { csv: await response.text(), nextAfter: cursor === null ? null : Number(cursor) };
}

export async function fetchAllAuditExport(filters: Record<string, string> = {}, fetcher: typeof fetch = fetch) {
  let after: number | null = null;
  let header: string | null = null;
  let csv = "";
  let parts = 0;
  do {
    const result = await fetchAuditExportPart(auditExportUrl(filters, after), fetcher);
    const firstLineEnd = result.csv.indexOf("\n");
    const pageHeader = (firstLineEnd < 0 ? result.csv : result.csv.slice(0, firstLineEnd)).replace(/\r$/, "");
    if (!pageHeader) throw new Error("Audit CSV returned an empty page.");
    if (header === null) {
      header = pageHeader;
      csv = result.csv;
    } else {
      if (pageHeader !== header) throw new Error("Audit CSV continuation returned a mismatched header.");
      const body = firstLineEnd < 0 ? "" : result.csv.slice(firstLineEnd + 1);
      csv += body;
    }
    parts += 1;
    if (result.nextAfter !== null && after !== null && result.nextAfter >= after) {
      throw new Error("Audit CSV continuation cursor did not advance.");
    }
    after = result.nextAfter;
  } while (after !== null);
  return { csv, parts };
}

export function AuditCsvDownload({ filters = {}, label = "Download audit CSV" }: { filters?: Record<string, string>; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { csv, parts } = await fetchAllAuditExport(filters);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage(`All matching audit events downloaded in ${parts} part${parts === 1 ? "" : "s"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Audit CSV download failed.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-2">
    <button type="button" className="btn" disabled={busy} onClick={() => void download()}>{busy ? "Downloading all matching events…" : label}</button>
    <p className="text-xs text-muted" aria-live="polite">{message ?? "Downloads every matching event in 1,000-row parts and combines them into one CSV."}</p>
    {error && <p role="alert" className="text-sm text-pink">{error}</p>}
  </div>;
}

export function AdminEvidenceExports({ authorized }: { authorized: boolean }) {
  if (!authorized) return null;
  return <Card>
    <h2 className="text-xl font-medium">CSV exports</h2>
    <p className="mt-1 text-sm text-muted">Authorized downloads from secured endpoints. Each request contains up to 1,000 rows. Audit CSV combines every matching page into one download.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      {(["ideas", "benefits", "feedback", "users"] as const).map(kind => <a key={kind} className="btn inline-flex" href={adminExportUrl(kind)}>Download {kind} CSV</a>)}
    </div>
    <div className="mt-4"><AuditCsvDownload /></div>
  </Card>;
}

/** Standalone admin evidence surface. Data is limited to existing secured read endpoints. */
export function AdminOperationsEvidence() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canExport = role ? hasCapability(role, CAPABILITIES.AUDIT_EXPORT) : false;
  const [analyticsPage, setAnalyticsPage] = useState(0);
  const [challengePage, setChallengePage] = useState(0);
  const users = useAdminUsers();
  const analytics = useAdminAnalytics();
  const audit = useAdminAudit();
  const screening = useAdminScreening();
  const transformation = useAdminTransformation();
  const challenges = useAdminChallenges();
  const feedback = useAdminFeedback();

  const rows = useMemo<EvidenceRow[]>(() => [
    { area: "people", metric: "users_returned", value: users.data?.items.length ?? 0, scope: "first 50 users from secured admin directory endpoint" },
    { area: "audit", metric: "events_returned", value: audit.data?.items.length ?? 0, scope: "first 50 events from secured admin audit endpoint" },
    { area: "governance", metric: "screening_items", value: screening.data?.items.length ?? 0, scope: "first 50 screening records" },
    { area: "governance", metric: "transformation_items", value: transformation.data?.items.length ?? 0, scope: "first 50 transformation records" },
    { area: "learning", metric: "open_challenges", value: challenges.data?.items.length ?? 0, scope: "currently active challenges visible to the signed-in admin" },
    { area: "engagement", metric: "feedback_responses", value: feedback.data?.items.length ?? 0, scope: "up to 100 secured admin feedback responses" },
    ...(analytics.data ? [
      ...analytics.data.ideasByStatus.map((item) => ({ area: "ideas", metric: `status_${item.status}`, value: item.count, scope: "all ideas" })),
      ...analytics.data.ideasByPriority.map((item) => ({ area: "ideas", metric: `priority_${item.band ?? "unassigned"}`, value: item.count, scope: "all ideas" })),
      ...analytics.data.usersByDepartment.map((item) => ({ area: "people", metric: `department_${item.department}`, value: item.count, scope: "all users" })),
      ...analytics.data.ideasByDepartment.map((item) => ({ area: "ideas", metric: `department_${item.department}`, value: item.count, scope: "all ideas" })),
      { area: "points", metric: "ledger_total", value: analytics.data.points.total, scope: "all ledger entries" },
      { area: "learning", metric: "quiz_attempts", value: analytics.data.learning.quizAttempts, scope: "all attempts" },
      { area: "learning", metric: "published_articles", value: analytics.data.learning.publishedArticles, scope: "current published articles" },
      { area: "learning", metric: "article_completions", value: analytics.data.learning.articleCompletions, scope: "all recorded completions" },
    ] : []),
  ], [users.data, audit.data, screening.data, transformation.data, challenges.data, feedback.data, analytics.data]);

  const analyticsItems = useMemo(() => {
    const data = analytics.data;
    if (!data) return [];
    return [
      ...data.usersByState.map((item) => `Users ${item.state}: ${item.count}`),
      ...data.ideasByStatus.map((item) => `${item.status}: ${item.count}`),
      ...data.ideasByPriority.map((item) => `${item.band ?? "Unassigned"}: ${item.count}`),
      ...data.usersByDepartment.map((item) => `${item.department}: ${item.count}`),
      `Points: ${data.points.total} across ${data.points.events} events`,
      `Quiz attempts: ${data.learning.quizAttempts}`,
      `Published articles: ${data.learning.publishedArticles}`,
      `Article completions: ${data.learning.articleCompletions}`,
      ...data.auditByAction.map((item) => `${item.action}: ${item.count}`),
    ];
  }, [analytics.data]);
  const analyticsPages = Math.max(1, Math.ceil(analyticsItems.length / 10));
  const challengeItems = challenges.data?.items ?? [];
  const challengePages = Math.max(1, Math.ceil(challengeItems.length / 10));

  const ready = [users, audit, analytics, screening, transformation, challenges, feedback].every((query) => query.isSuccess);
  const refresh = () => void Promise.all([users.refetch(), audit.refetch(), analytics.refetch(), screening.refetch(), transformation.refetch(), challenges.refetch(), feedback.refetch()]);

  return <div className="stack">
    <SectionHeading title="Operations evidence" detail="Bounded, read-only operational summaries and controlled exports" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile value={users.data?.items.length ?? "—"} label="Users in view" />
      <StatTile value={screening.data?.items.length ?? "—"} label="Screening items" />
      <StatTile value={challenges.data?.items.length ?? "—"} label="Open challenges" />
      <StatTile value={audit.data?.items.length ?? "—"} label="Audit events in view" />
    </div>
    {analytics.isPending ? <Card><p role="status" aria-busy="true">Loading analytics…</p></Card> : analytics.isError ? <Card><p role="alert">Analytics unavailable.</p><button className="btn mt-2" onClick={() => void analytics.refetch()}>Retry analytics</button></Card> : analytics.data && <Card>
      <h2 className="text-xl font-medium">Platform analytics</h2>
      <p className="mt-1 text-xs text-muted">Generated {new Date(analytics.data.generatedAt).toLocaleString()}</p>
      <div className="mt-3 flex flex-wrap gap-2">{analyticsItems.slice(analyticsPage * 10, analyticsPage * 10 + 10).map((item, index) => <span className="pill" key={`${analyticsPage}-${index}`}>{item}</span>)}</div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm"><span className="text-muted">Page {analyticsPage + 1} of {analyticsPages} · 10 per page</span><div className="flex gap-2"><button className="btn btn-small" type="button" disabled={analyticsPage === 0} onClick={() => setAnalyticsPage((page) => page - 1)}>Previous</button><button className="btn btn-small" type="button" disabled={analyticsPage + 1 >= analyticsPages} onClick={() => setAnalyticsPage((page) => page + 1)}>Next</button></div></div>
    </Card>}
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-xl font-medium">Evidence exports</h2><p className="mt-1 max-w-2xl text-sm text-muted">The summary CSV contains aggregate counts and scope labels only. Authorized server exports are listed below.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={refresh}>Refresh evidence</button>
          {canExport && <button type="button" className="btn-primary" disabled={!ready} onClick={() => downloadCsv(rows)}>Download summary CSV</button>}
        </div>
      </div>
      {!ready && <p className="mt-3 text-xs text-muted">Summary export becomes available after all bounded source queries load successfully.</p>}
      <div className="mt-5 divide-y" style={{ borderColor: "var(--line)" }}>
        <div className="grid gap-2 py-3 text-xs font-medium uppercase tracking-wide text-muted sm:grid-cols-[1fr_2fr]"><span>Source</span><span>Available evidence</span></div>
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_2fr]"><b className="font-medium">People directory</b><State label="users" pending={users.isPending} error={users.isError} count={users.data?.items.length} /></div>
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_2fr]"><b className="font-medium">Audit log</b><State label="audit events" pending={audit.isPending} error={audit.isError} count={audit.data?.items.length} /></div>
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_2fr]"><b className="font-medium">Idea governance</b><span className="text-sm text-muted">{screening.isError || transformation.isError ? "Governance queue unavailable" : screening.isPending || transformation.isPending ? "Loading queues…" : `${screening.data?.items.length ?? 0} screening · ${transformation.data?.items.length ?? 0} transformation`}</span></div>
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_2fr]"><b className="font-medium">Learning challenges</b><State label="challenges" pending={challenges.isPending} error={challenges.isError} count={challenges.data?.items.length} /></div>
        <div className="grid gap-2 py-3 sm:grid-cols-[1fr_2fr]"><b className="font-medium">Feedback campaigns</b><State label="feedback" pending={feedback.isPending} error={feedback.isError} count={feedback.data?.items.length} /></div>
      </div>
    </Card>
    <AdminEvidenceExports authorized={canExport} />
    <Card>
      <h2 className="text-xl font-medium">Challenge and campaign operations</h2>
      <p className="mt-1 text-sm text-muted">Manage challenges, campaigns and announcements in Engagement. Campaign feedback can be reviewed and answered through the secured response workflow.</p>
      {challenges.isPending ? <p className="mt-4 text-sm text-muted" role="status">Loading challenges…</p> : challenges.isError ? <p className="mt-4 text-sm text-pink" role="alert">Challenge list is unavailable.</p> : <div className="mt-4 space-y-2">{challengeItems.length ? challengeItems.slice(challengePage * 10, challengePage * 10 + 10).map((challenge) => <article key={challenge.id} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{challenge.title}</h3><span className="pill">{challenge.participants} participants · {challenge.points} points</span></div><p className="mt-1 text-sm text-muted">{challenge.question}</p><p className="mt-2 text-xs text-muted">Closes {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(challenge.deadlineAt))}</p></article>) : <p className="text-sm text-muted">No active challenges are available.</p>}</div>}
      {challengeItems.length > 10 && <div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-muted">Page {challengePage + 1} of {challengePages} · 10 per page</span><div className="flex gap-2"><button type="button" className="btn btn-small" disabled={challengePage === 0} onClick={() => setChallengePage((page) => page - 1)}>Previous</button><button type="button" className="btn btn-small" disabled={challengePage + 1 >= challengePages} onClick={() => setChallengePage((page) => page + 1)}>Next</button></div></div>}
      <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--line)" }}><AdminFeedbackResponses /></div>
      <div className="mt-5 rounded-xl border border-dashed p-4" style={{ borderColor: "var(--line-strong)" }}><h3 className="font-medium">Announcements</h3><p className="mt-1 text-sm text-muted">Create and pin announcements in the Engagement workspace. Each change requires an audit reason.</p></div>
    </Card>
  </div>;
}
