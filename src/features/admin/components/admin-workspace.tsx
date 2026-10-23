"use client";

import { useSession } from "next-auth/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Card,
  SectionHeading,
  StatTile,
} from "../../../components/ui";
import { capabilitiesForRole, hasCapability, CAPABILITIES, type UserRole } from "../../../lib/auth/permissions";
import {
  useAdminAnalytics,
} from "../hooks";
import { apiFetch } from "../../../lib/api/client";
import { AdminEngagementManager } from "./admin-engagement-manager";
import { AdminBadgeManager } from "./admin-badge-manager";
import { AdminFeedbackResponses } from "./admin-feedback-responses";
import { AdminPeopleManagement } from "./admin-people-management";
import AdminLearningContent from "./admin-learning-content";
import { AdminSettingsEditor } from "./admin-settings-editor";
import { AdminEvaluation } from "./admin-evaluation";
import { AdminDelivery } from "./admin-delivery";
import { AdminRewardCatalogueManager } from "./admin-reward-catalogue-manager";
import { AdminEvidenceExports, AuditCsvDownload, OperationsAnalytics } from "./admin-operations-evidence";
import { AdminQueueTable } from "./admin-transformation-queues";
import { AdminShell, visibleAdminViews, type AdminView } from "./admin-shell";
import type {
  AdminAuditEvent,
} from "../types";
import { AdminDrawer, AdminPagination } from "./admin-data-ui";

type AdminWorkspaceProps = { email: string };
type SubnavItem = { id: string; label: string };

const governanceItems: SubnavItem[] = [
  { id: "screening", label: "Screening" },
  { id: "transformation", label: "Transformation" },
];



function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function queryMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function SectionTabs({
  items,
  active,
  onChange,
}: {
  items: SubnavItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Admin section"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          onClick={() => onChange(item.id)}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${active === item.id ? "border-blue bg-blue text-white" : "border-[var(--line-strong)] text-muted hover:bg-[var(--hover)]"}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function StatePanel({
  title,
  detail,
  tone = "muted",
}: {
  title: string;
  detail: string;
  tone?: "muted" | "error" | "success";
}) {
  const toneClass =
    tone === "error"
      ? "border-pink/40 bg-pink/5"
      : tone === "success"
        ? "border-teal/40 bg-teal/5"
        : "border-[var(--line)] bg-[var(--hover)]";
  return (
    <div
      className={`rounded-[14px] border p-4 ${toneClass}`}
      role={tone === "error" ? "alert" : undefined}
    >
      <b className="font-medium">{title}</b>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </div>
  );
}

function LoadingRows({ label }: { label: string }) {
  return (
    <div className="space-y-3" aria-label={label} aria-busy="true">
      <div className="h-12 animate-pulse rounded-xl bg-blue/5" />
      <div className="h-12 animate-pulse rounded-xl bg-blue/5" />
      <div className="h-12 animate-pulse rounded-xl bg-blue/5" />
    </div>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return <StatePanel title={title} detail={detail} />;
}

type WorkspacePage<T> = { items: T[]; nextAfter: number | null; total?: number };
function useWorkspacePages<T>(path: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["admin", "workspace", "pages", path] as const,
    queryFn: ({ pageParam }) => {
      const separator = path.includes("?") ? "&" : "?";
      return apiFetch<WorkspacePage<T>>(`${path}${separator}limit=10${pageParam === null ? "" : `&after=${pageParam}`}`);
    },
    initialPageParam: null as number | null,
    getNextPageParam: page => page.nextAfter ?? undefined,
    enabled,
  });
}

export function DashboardPanel({ role }: { role?: UserRole }) {
  const analytics = useAdminAnalytics();
  if (analytics.isPending) return <LoadingRows label="Loading dashboard" />;
  if (analytics.isError) return <StatePanel title="Dashboard unavailable" detail={queryMessage(analytics.error, "The dashboard could not be loaded.")} tone="error" />;
  const data = analytics.data;
  const count = (status: string) => data.ideasByStatus.find(item => item.status === status)?.count ?? 0;
  return <div className="stack"><div><h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1><p className="mt-2 text-muted">A live summary of ideas moving through the back office.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatTile value={count("screening")} label="Awaiting screening" /><StatTile value={count("decision")} label="Awaiting confirmation" /><StatTile value={count("poc")} label="In proof of concept" /><StatTile value={count("implementation")} label="In implementation" /></div><p className="text-sm text-muted">Updated {dateLabel(data.generatedAt)}. Open a workspace section to review its records.</p><OperationsAnalytics data={data} /><AdminEvidenceExports authorized={role ? hasCapability(role, CAPABILITIES.AUDIT_EXPORT) : false} /></div>;
}

function GovernancePanel() {
  const [active, setActive] = useState("screening");
  return <div className="stack">
    <SectionHeading title="Ideas" detail="Live governance queues and decisions" />
    <SectionTabs items={[...governanceItems, { id: "controls", label: "Control approvals" }]} active={active} onChange={setActive} />
    {active === "screening" ? <AdminQueueTable kind="screening" title="Screening" detail="Accept an idea directly into proof of concept, route it to a business owner, return it, reject it or defer it." empty="No ideas are waiting for screening." />
      : active === "transformation" ? <AdminQueueTable kind="transformation" title="Transformation" detail="Owner-approved ideas appear here for final confirmation. Open an idea and choose Confirm and accept to start its proof of concept." empty="No ideas are waiting for confirmation." />
      : <AdminEvaluation mode="control" />}
  </div>;
}

function PeoplePanel({ currentUserId }: { currentUserId?: number }) {
  const roles: UserRole[] = ["employee", "back_office", "business_owner"];
  return (
    <div className="stack">
      <SectionHeading title="Users" detail="Accounts, roles and session activity" />
      <AdminPeopleManagement currentUserId={currentUserId} />
      <details className="rounded-xl border border-[var(--line)] bg-white p-5">
        <summary className="cursor-pointer font-medium">Role permissions</summary>
        <p className="mt-2 text-sm text-muted">Assign one of the three roles in the user list above. Each role has these server-enforced capabilities.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{roles.map(role => <div key={role} className="rounded-xl border border-[var(--line)] p-4"><h3 className="font-medium capitalize">{role.replaceAll("_", " ")}</h3><ul className="mt-2 space-y-1 text-xs text-muted">{capabilitiesForRole(role).map(capability => <li key={capability}>{capability}</li>)}</ul></div>)}</div>
      </details>
    </div>
  );
}

function LearningPanel() {
  return <div className="stack">
    <AdminLearningContent />
  </div>;
}

function RewardsPanel() {
  return <div className="stack"><SectionHeading title="Rewards" detail="Configure the employee reward catalogue and recognition." /><AdminRewardCatalogueManager /></div>;
}

function EngagementSection({ area }: { area: "announcements" | "campaigns" | "challenges" }) {
  return <div className={`admin-engagement-${area}`}>
    <style>{`.admin-engagement-announcements > div > section:not(:first-of-type), .admin-engagement-campaigns > div > section:not(:nth-of-type(2)), .admin-engagement-challenges > div > section:not(:nth-of-type(3)) { display: none; }`}</style>
    <AdminEngagementManager />
  </div>;
}

function EngagementPanel() {
  const [active, setActive] = useState("responses");
  return (
    <div className="stack">
      <SectionHeading title="Demo Feedback" detail="Campaign feedback and responses" />
      <SectionTabs items={[{ id: "responses", label: "Responses" }, { id: "campaigns", label: "Campaigns" }]} active={active} onChange={setActive} />
      {active === "responses" ? <AdminFeedbackResponses /> : <EngagementSection area="campaigns" />}
    </div>
  );
}

function AuditPanel({ role }: { role?: UserRole }) {
  const [active, setActive] = useState("audit-log");
  const canExport = role ? hasCapability(role, CAPABILITIES.AUDIT_EXPORT) : false;
  const [filters, setFilters] = useState({
    action: "",
    actorUserId: "",
    targetType: "",
    targetId: "",
    from: "",
    to: "",
    ipHash: "",
  });
  const items = [
    { id: "audit-log", label: "Audit log" },
    { id: "exports", label: "Exports" },
    { id: "operations", label: "Operations summary" },
  ];
  return (
    <div className="stack">
      <SectionHeading title="Audit & export" detail="Evidence-first controls" />
      <SectionTabs items={items} active={active} onChange={setActive} />
      {active === "audit-log" ? (
        <>
          <Card>
            <h2 className="text-lg font-medium">Filter audit events</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["action", "Action"],
                  ["actorUserId", "Actor user ID"],
                  ["targetType", "Target type"],
                  ["targetId", "Target ID"],
                  ["from", "From date"],
                  ["to", "To date"],
                  ["ipHash", "IP hash"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-sm">
                  {label}
                  <input
                    className="input mt-1"
                    type={
                      key === "from" || key === "to" ? "datetime-local" : "text"
                    }
                    value={filters[key]}
                    onChange={(event) =>
                      setFilters({ ...filters, [key]: event.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            {canExport && <div className="mt-3"><AuditCsvDownload filters={filters} label="Download filtered audit CSV" /></div>}
          </Card>
          <AuditTable key={JSON.stringify(filters)} filters={filters} />
        </>
      ) : active === "operations" ? (
        <DashboardPanel role={role} />
      ) : (
        <AdminEvidenceExports authorized={canExport} />
      )}
    </div>
  );
}

function AuditTable({ filters }: { filters: Record<string, string> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
  const path = `/api/admin/audit${params.size ? `?${params}` : ""}`;
  const query = useWorkspacePages<AdminAuditEvent>(path, true);
  const [requestedPage, setPage] = useState(0);
  const pages = query.data?.pages ?? [];
  const records = pages.flatMap(batch => batch.items);
  const pageCount = Math.max(1, Math.ceil(records.length / 10));
  const page = Math.min(requestedPage, pageCount - 1);
  const events = records.slice(page * 10, page * 10 + 10);
  const [selected, setSelected] = useState<AdminAuditEvent | null>(null);
  function nextPage() {
    if (page < pageCount - 1) setPage(page + 1);
    else void query.fetchNextPage().then(result => { if (!result.isError && events.length === 10 && (result.data?.pages.flatMap(batch => batch.items).length ?? 0) > (page + 1) * 10) setPage(page + 1); });
  }
  if (query.isPending) return <LoadingRows label="Loading audit events" />;
  if (query.isError && !query.data)
    return (
      <StatePanel
        title="Audit log unavailable"
        detail={queryMessage(query.error, "The audit log could not be loaded.")}
        tone="error"
      />
    );
  if (!events.length && !query.hasNextPage)
    return (
      <EmptyPanel
        title="No audit events"
        detail="No immutable activity has been recorded yet."
      />
    );
  return (
    <Card>
      {!events.length && <p className="text-sm text-muted">No audit events in the records loaded so far. Select Next to check the next page.</p>}
      <div className="overflow-x-auto rounded-xl border border-[var(--line)]"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[var(--hover)] text-xs text-muted"><tr>{["#", "Action", "Target", "Actor", "When", "Details"].map(label => <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>
        {events.map((event: AdminAuditEvent) => (
          <tr key={event.id} className="border-t border-[var(--line)]"><td className="px-3 py-2">{page * 10 + events.indexOf(event) + 1}</td><td className="px-3 py-2"><span className="pill">{event.action}</span></td><td className="px-3 py-2">{event.targetType ?? "event"} {event.targetId ?? ""}<span className="block max-w-[280px] truncate text-xs text-muted">{event.reason}</span></td><td className="px-3 py-2">{event.actorUserId ?? "system"}</td><td className="px-3 py-2 whitespace-nowrap">{dateLabel(event.createdAt)}</td><td className="px-3 py-2"><button type="button" className="btn btn-small" onClick={() => setSelected(event)}>View</button></td></tr>
        ))}
      </tbody></table></div>
      <AdminPagination label="Audit trail" page={page + 1} pageSize={10} total={query.data?.pages[0]?.total ?? (records.length + (query.hasNextPage ? 1 : 0))} busy={query.isFetchingNextPage} onPageChange={number => { if (number <= pageCount) setPage(number - 1); else void nextPage(); }} />
      {query.error && <p role="alert" className="mt-3 text-sm text-pink">{queryMessage(query.error, "The next audit page could not be loaded.")}</p>}
      <AdminDrawer open={selected !== null} onClose={() => setSelected(null)} title={selected?.action ?? "Audit event"} description={selected ? `${selected.targetType ?? "event"} ${selected.targetId ?? ""} · ${dateLabel(selected.createdAt)}` : undefined}><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted">Actor</dt><dd>{selected?.actorUserId ?? "system"}</dd></div><div><dt className="text-muted">Session</dt><dd>{selected?.sessionId ?? "—"}</dd></div><div><dt className="text-muted">IP hash</dt><dd className="break-all">{selected?.ipHash ?? "—"}</dd></div><div><dt className="text-muted">Reason</dt><dd>{selected?.reason ?? "—"}</dd></div><div className="sm:col-span-2"><dt className="text-muted">Metadata</dt><dd className="mt-1 break-words font-mono text-xs">{selected ? JSON.stringify(selected.metadata, null, 2) : "—"}</dd></div></dl></AdminDrawer>
    </Card>
  );
}

function SettingsPanel() {
  return (
    <div className="stack">
      <AdminSettingsEditor className="!border-0 !p-0 !shadow-none [&>h2]:text-3xl" />
      <details className="rounded-xl border border-[var(--line)] bg-white p-5"><summary className="cursor-pointer font-medium">Badge management</summary><div className="mt-5"><AdminBadgeManager /></div></details>
    </div>
  );
}

export function AdminWorkspace({ email }: AdminWorkspaceProps) {
  const { data: session, status } = useSession();
  const [requestedView, setRequestedView] = useState<AdminView>("dashboard");
  if (status === "loading") return <main className="min-h-screen bg-[#f8faff] p-6" role="status" aria-busy="true">Loading back office…</main>;
  if (!session?.user) return <main className="min-h-screen bg-[#f8faff] p-6" role="alert">Your session has ended. Sign in to open the back office.</main>;
  const role = session.user.role;
  const views = visibleAdminViews(role);
  const active = views.includes(requestedView) ? requestedView : views[0] ?? "dashboard";
  const currentUserId = session?.user?.id ? Number(session.user.id) : undefined;
  let content;
  switch (active) {
    case "dashboard": content = <DashboardPanel role={role} />; break;
    case "ideas": content = role === "business_owner" ? <AdminEvaluation /> : <GovernancePanel />; break;
    case "delivery": content = <AdminDelivery />; break;
    case "feedback": content = <EngagementPanel />; break;
    case "learning": content = <LearningPanel />; break;
    case "challenges": content = <div className="stack"><SectionHeading title="Challenges" /><EngagementSection area="challenges" /></div>; break;
    case "announcements": content = <div className="stack"><SectionHeading title="Announcements" /><EngagementSection area="announcements" /></div>; break;
    case "rewards": content = <RewardsPanel />; break;
    case "users": content = <PeoplePanel currentUserId={currentUserId} />; break;
    case "settings": content = <SettingsPanel />; break;
    case "audit": content = <AuditPanel role={role} />; break;
  }
  return <AdminShell email={email} name={session.user.name} role={role} views={views} active={active} onNavigate={setRequestedView}>{content}</AdminShell>;
}
