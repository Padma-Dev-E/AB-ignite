"use client";

import Link from "next/link";
import { Dialog, DialogPanel, DialogTitle, Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Card, IconBox, SectionHeading, StatTile } from "../../../components/ui";
import { useAdminAudit, useAdminChallenges, useAdminGovernanceDecision, useAdminQuizCatalogue, useAdminRedemptionAction, useAdminRedemptions, useAdminRewards, useAdminScreening, useAdminTransformation, useAdminUsers } from "../hooks";
import { AdminFeedbackResponses } from "./admin-feedback-responses";
import { AdminPeopleManagement } from "./admin-people-management";
import { AdminRewardCatalogueManager } from "./admin-reward-catalogue-manager";
import AdminLearningContent from "./admin-learning-content";
import { AdminOperationsEvidence } from "./admin-operations-evidence";
import { AdminSettingsEditor } from "./admin-settings-editor";
import { AdminEvaluation } from "./admin-evaluation";
import type { GovernanceAction, RedemptionAction } from "../api";
import type { AdminAuditEvent, AdminChallenge, AdminIdea, AdminQuiz, AdminRedemption, AdminReward, AdminUser } from "../types";

type AdminWorkspaceProps = { email: string };
type SubnavItem = { id: string; label: string };

const workspaceTabs = [
  { id: "governance", label: "Governance", description: "Idea control room" },
  { id: "people", label: "People & access", description: "Users and sessions" },
  { id: "learning", label: "Learning", description: "Quizzes and challenges" },
  { id: "rewards", label: "Rewards", description: "Catalogue and redemptions" },
  { id: "engagement", label: "Engagement", description: "Campaign feedback" },
  { id: "audit", label: "Audit & export", description: "Evidence and exports" },
  { id: "settings", label: "Settings", description: "Platform controls" },
] as const;

const governanceItems: SubnavItem[] = [
  { id: "screening", label: "Screening" },
  { id: "transformation", label: "Transformation" },
  { id: "evaluation", label: "Evaluation" },
];

const peopleItems: SubnavItem[] = [
  { id: "users", label: "Users" },
  { id: "rbac", label: "RBAC" },
  { id: "sessions", label: "Sessions" },
];

const learningItems: SubnavItem[] = [
  { id: "quiz-catalogue", label: "Quiz catalogue" },
  { id: "challenges", label: "Challenges" },
  { id: "content", label: "Content management" },
];

const rewardItems: SubnavItem[] = [
  { id: "reward-catalogue", label: "Catalogue" },
  { id: "redemptions", label: "Redemptions" },
];

function labelFor(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function queryMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function SectionTabs({ items, active, onChange }: { items: SubnavItem[]; active: string; onChange: (id: string) => void }) {
  return <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin section">
    {items.map((item) => <button key={item.id} type="button" role="tab" aria-selected={active === item.id} onClick={() => onChange(item.id)} className={`rounded-full border px-3 py-1.5 text-sm transition ${active === item.id ? "border-blue bg-blue text-white" : "border-[var(--line-strong)] text-muted hover:bg-[var(--hover)]"}`}>{item.label}</button>)}
  </div>;
}

function StatePanel({ title, detail, tone = "muted" }: { title: string; detail: string; tone?: "muted" | "error" | "success" }) {
  const toneClass = tone === "error" ? "border-pink/40 bg-pink/5" : tone === "success" ? "border-teal/40 bg-teal/5" : "border-[var(--line)] bg-[var(--hover)]";
  return <div className={`rounded-[14px] border p-4 ${toneClass}`} role={tone === "error" ? "alert" : undefined}><b className="font-medium">{title}</b><p className="mt-1 text-sm text-muted">{detail}</p></div>;
}

function LoadingRows({ label }: { label: string }) {
  return <div className="space-y-3" aria-label={label} aria-busy="true"><div className="h-12 animate-pulse rounded-xl bg-blue/5" /><div className="h-12 animate-pulse rounded-xl bg-blue/5" /><div className="h-12 animate-pulse rounded-xl bg-blue/5" /></div>;
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return <StatePanel title={title} detail={detail} />;
}

function OverviewHeader({ email }: AdminWorkspaceProps) {
  return <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-start sm:justify-between" style={{ borderColor: "var(--line)" }}>
    <div className="flex gap-3">
      <IconBox tone="blue"><span aria-hidden="true" className="text-lg">⌁</span></IconBox>
      <div>
        <div className="flex flex-wrap items-center gap-2"><span className="pill"><span className="pill-dot" />Protected admin</span><span className="text-xs text-muted">Internal use</span></div>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em]">Admin control room</h1>
        <p className="mt-2 max-w-[660px] text-muted">Manage the bank’s idea, learning and recognition surfaces from one governed workspace.</p>
      </div>
    </div>
    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end"><span className="text-xs text-muted">Signed in as</span><span className="max-w-[260px] truncate text-sm font-medium" title={email}>{email}</span><Link href="/private" className="btn btn-small mt-1">Back to app</Link></div>
  </header>;
}

function SummaryStrip() {
  return <div className="grid gap-3 sm:grid-cols-3"><StatTile value="6" label="governed work areas" /><StatTile value="2" label="audited write queues" /><StatTile value="live" label="session-protected data" /></div>;
}

function UnconfiguredSection({ title, description, owner }: { title: string; description: string; owner: string }) {
  return <Card className="border-dashed"><div className="flex items-start gap-3"><IconBox tone="sand"><span aria-hidden="true" className="text-lg">◌</span></IconBox><div className="min-w-0"><h2 className="text-xl font-medium">{title}</h2><p className="mt-1 max-w-[680px] text-sm text-muted">{description}</p></div></div><div className="mt-5"><StatePanel title="Not configured" detail={`${owner} is not connected yet. This surface stays read-only until its audited endpoint is available.`} /></div></Card>;
}

function GovernancePanel() {
  const [active, setActive] = useState("screening");
  const screening = useAdminScreening(active === "screening");
  const transformation = useAdminTransformation(active === "transformation");
  const copy = {
    screening: ["Screening queue", "Review submitted ideas and their AI screening evidence with traceable decisions.", "Idea screening"],
    transformation: ["Transformation pipeline", "Follow ideas moving from validated opportunity to an accountable delivery path.", "Transformation workflow"],
    evaluation: ["Evaluation workspace", "Compare impact, risk and feasibility evidence before a governed decision.", "Idea evaluation"],
  } as const;
  const [title, description, owner] = copy[active as keyof typeof copy];
  const query = active === "screening" ? screening : transformation;
  return <div className="stack"><SectionHeading title="Idea governance" detail="Live queue reads · reasoned mutations" /><SectionTabs items={governanceItems} active={active} onChange={setActive} />{active === "evaluation" ? <AdminEvaluation /> : <IdeaQueue query={query} title={title} detail={description} />}</div>;
}

function IdeaQueue({ query, title, detail }: { query: ReturnType<typeof useAdminScreening> | ReturnType<typeof useAdminTransformation>; title: string; detail: string }) {
  const mutation = useAdminGovernanceDecision();
  const usersQuery = useAdminUsers(true);
  const [pending, setPending] = useState<{ idea: AdminIdea; action: GovernanceAction; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [businessOwnerId, setBusinessOwnerId] = useState("");
  const [success, setSuccess] = useState("");
  if (query.isPending) return <LoadingRows label={`Loading ${title}`} />;
  if (query.isError) return <StatePanel title={`${title} unavailable`} detail={queryMessage(query.error, "The governance queue could not be loaded.")} tone="error" />;
  if (!query.data?.items.length) return <EmptyPanel title={`No ideas in ${title.toLowerCase()}`} detail="The governed queue is connected, but no records match this stage." />;
  const actions: Record<string, Array<[GovernanceAction, string]>> = { screening: [["route", "Send to business owner"], ["return", "Return"], ["reject", "Reject"], ["defer", "Defer"]], business_review: [["approve", "Approve"], ["not_recommended", "Not recommended"], ["confirm", "Confirm"]], control_review: [["approve", "Approve"], ["not_recommended", "Not recommended"], ["confirm", "Confirm and accept"]] };
  async function submitDecision(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const owner = Number(businessOwnerId); if (!pending || reason.trim().length < 1 || reason.trim().length > 500 || (pending.action === "route" && (!Number.isInteger(owner) || owner < 1))) return; setSuccess(""); try { await mutation.mutateAsync({ ideaId: pending.idea.id, action: pending.action, reason: reason.trim(), businessOwnerId: pending.action === "route" ? owner : undefined }); setSuccess(`${pending.label} decision saved for ${pending.idea.reference}.`); setPending(null); setReason(""); setBusinessOwnerId(""); } catch { /* mutation state is shown in the dialog */ } }
  return <><Card><div className="mb-4"><h2 className="text-xl font-medium">{title}</h2><p className="mt-1 text-sm text-muted">{detail}</p></div>{success && <div className="mb-3" role="status"><StatePanel title="Decision recorded" detail={success} tone="success" /></div>}<div className="space-y-2">{query.data.items.map((idea: AdminIdea) => <article key={idea.id} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><div className="flex flex-wrap items-center gap-2"><span className="pill">{idea.reference}</span><span className="pill text-blue border-blue/40">{idea.priorityBand ?? "Unscored"}</span><span className="ml-auto text-xs text-muted">{dateLabel(idea.createdAt)}</span></div><h3 className="mt-2 font-medium">{idea.title}</h3><p className="mt-1 text-sm text-muted">{idea.authorName} · {idea.department} · {idea.priorityScore?.toFixed(2) ?? "—"}</p><div className="mt-3 flex flex-wrap gap-2">{(actions[idea.status] ?? []).map(([action, label]) => <button key={action} type="button" className="btn btn-small" disabled={mutation.isPending} onClick={() => { mutation.reset(); setPending({ idea, action, label }); setReason(""); setBusinessOwnerId(""); }}>{label}</button>)}</div></article>)}</div></Card><Dialog open={!!pending} onClose={() => !mutation.isPending && setPending(null)} className="relative z-50"><div className="fixed inset-0 bg-black/40" aria-hidden="true"/><div className="fixed inset-0 flex items-center justify-center p-4"><DialogPanel className="w-full max-w-lg rounded-2xl border bg-[var(--card)] p-5 shadow-xl" style={{ borderColor: "var(--line)" }}><DialogTitle className="text-lg font-medium">{pending?.label} · {pending?.idea.reference}</DialogTitle><form className="mt-4 space-y-3" onSubmit={submitDecision}><label className="block text-sm">Reason <textarea autoFocus required minLength={1} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border bg-transparent p-3" /></label>{pending?.action === "route" && <label className="block text-sm"><span className="field-label">Business owner</span><select className="input mt-1" required value={businessOwnerId} onChange={(event) => setBusinessOwnerId(event.target.value)}><option value="">Select an active owner</option>{(usersQuery.data?.items ?? []).filter((user) => user.isActive).map((user) => <option key={user.id} value={user.id}>{user.name} · {user.department}</option>)}</select><span className="mt-1 block text-xs text-muted">Owner assignment is stored in the workflow event and notified by the server.</span></label>}<p className="text-xs text-muted">Required, up to 500 characters.</p>{mutation.isError && <StatePanel title="Decision failed" detail={queryMessage(mutation.error, "The decision could not be saved.")} tone="error" />}<div className="flex justify-end gap-2"><button type="button" className="btn" disabled={mutation.isPending} onClick={() => setPending(null)}>Close</button><button type="submit" className="btn-primary" disabled={mutation.isPending || !reason.trim() || (pending?.action === "route" && !businessOwnerId)}>{mutation.isPending ? "Saving…" : "Confirm decision"}</button></div></form></DialogPanel></div></Dialog></>;
}

function PeoplePanel() {
  const [active, setActive] = useState("users");
  const usersQuery = useAdminUsers(active === "users");
  const copy = {
    users: ["Users", "View user lifecycle, account state and ownership once the admin directory endpoint is connected."],
    rbac: ["RBAC", "Review role assignments and capability grants without exposing privilege-changing controls in an unconfigured surface."],
    sessions: ["Sessions", "Inspect active and recent sessions with revocation evidence and last-seen context."],
  } as const;
  const [title, description] = copy[active as keyof typeof copy];
  return <div className="stack"><SectionHeading title="People & access" detail="Protected by admin role" /><SectionTabs items={peopleItems} active={active} onChange={setActive} />{active === "users" ? <AdminPeopleManagement /> : <UnconfiguredSection title={title} description={description} owner={`${title} administration`} />}</div>;
}

function UserTable({ query }: { query: ReturnType<typeof useAdminUsers> }) {
  if (query.isPending) return <LoadingRows label="Loading users" />;
  if (query.isError) return <StatePanel title="Users unavailable" detail={queryMessage(query.error, "The user directory could not be loaded.")} tone="error" />;
  if (!query.data?.items.length) return <EmptyPanel title="No users" detail="No bank users are available for this view." />;
  return <Card><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs text-muted"><tr><th className="px-2 py-3 font-medium">User</th><th className="px-2 py-3 font-medium">Role</th><th className="px-2 py-3 font-medium">State</th><th className="px-2 py-3 font-medium">Last seen</th><th className="px-2 py-3 font-medium">Sessions</th></tr></thead><tbody>{query.data.items.map((user: AdminUser) => <tr key={user.id} className="border-b last:border-0" style={{ borderColor: "var(--line)" }}><td className="px-2 py-3"><b>{user.name}</b><span className="block text-xs text-muted">{user.email} · {user.department}</span></td><td className="px-2 py-3"><span className="pill">{user.role}</span></td><td className={`px-2 py-3 font-medium ${user.isActive ? "text-teal" : "text-pink"}`}>{user.isActive ? "Active" : "Deactivated"}</td><td className="px-2 py-3 text-muted">{dateLabel(user.lastSeenAt)}</td><td className="px-2 py-3 text-muted">{user.failedLoginAttempts ? `${user.failedLoginAttempts} failed attempts` : "No recent failures"}</td></tr>)}</tbody></table></div></Card>;
}

function QuizCatalogue({ items, isLoading, isError, error }: { items: AdminQuiz[] | undefined; isLoading: boolean; isError: boolean; error: unknown }) {
  if (isLoading) return <LoadingRows label="Loading quiz catalogue" />;
  if (isError) return <StatePanel title="Quiz catalogue unavailable" detail={queryMessage(error, "The quiz catalogue could not be loaded.")} tone="error" />;
  if (!items?.length) return <EmptyPanel title="No published quizzes" detail="The catalogue endpoint is connected, but no published quizzes are available." />;
  return <div className="overflow-hidden rounded-[14px] border" style={{ borderColor: "var(--line)" }}><div className="hidden grid-cols-[1.5fr_.8fr_.8fr_.6fr] gap-3 border-b bg-[var(--hover)] px-4 py-3 text-xs font-medium text-muted sm:grid"><span>Quiz</span><span>Level</span><span>Questions</span><span>Pass mark</span></div>{items.map((quiz) => <div className="grid gap-2 border-b px-4 py-4 last:border-0 sm:grid-cols-[1.5fr_.8fr_.8fr_.6fr] sm:items-center sm:gap-3" style={{ borderColor: "var(--line)" }} key={quiz.id}><div><b className="font-medium">{quiz.title}</b><p className="mt-0.5 text-xs text-muted">{labelFor(quiz.category)} · v{quiz.version}</p></div><span className="text-sm text-muted">{labelFor(quiz.level)}</span><span className="text-sm text-muted">{quiz.questionCount}</span><span className="text-sm font-medium">{quiz.passMark}%</span></div>)}</div>;
}

function ChallengeList({ items, isLoading, isError, error }: { items: AdminChallenge[] | undefined; isLoading: boolean; isError: boolean; error: unknown }) {
  if (isLoading) return <LoadingRows label="Loading challenges" />;
  if (isError) return <StatePanel title="Challenges unavailable" detail={queryMessage(error, "The challenge list could not be loaded.")} tone="error" />;
  if (!items?.length) return <EmptyPanel title="No open challenges" detail="The challenge endpoint is connected, but no active challenges are open right now." />;
  return <div className="grid gap-3 lg:grid-cols-2">{items.map((challenge) => <article className="rounded-[14px] border p-4" style={{ borderColor: "var(--line)" }} key={challenge.id}><div className="flex items-start justify-between gap-3"><div><span className="pill text-teal border-teal/40"><span className="pill-dot" />Open</span><h3 className="mt-3 font-medium">{challenge.title}</h3></div><span className="text-sm font-medium text-sand">{challenge.points} pts</span></div><p className="mt-2 text-sm text-muted">{challenge.question}</p><div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span>{challenge.participants} participants</span><span>Closes {dateLabel(challenge.deadlineAt)}</span></div></article>)}</div>;
}

function LearningPanel() {
  const [active, setActive] = useState("quiz-catalogue");
  const quizQuery = useAdminQuizCatalogue(true);
  const challengeQuery = useAdminChallenges(true);
  return <div className="stack"><SectionHeading title="Learning catalogue" detail="Live catalogue, content controls and challenges" /><SectionTabs items={learningItems} active={active} onChange={setActive} />{active === "content" ? <AdminLearningContent /> : active === "quiz-catalogue" ? <Card><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-medium">Published quizzes</h2><p className="mt-1 text-sm text-muted">Versions and question counts are read from the learning catalogue.</p></div><span className="pill text-teal border-teal/40"><span className="pill-dot" />Connected</span></div><QuizCatalogue {...quizQuery} items={quizQuery.data?.items} /></Card> : <Card><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-medium">Open challenges</h2><p className="mt-1 text-sm text-muted">Active challenges are visible here without exposing join or edit mutations.</p></div><span className="pill text-teal border-teal/40"><span className="pill-dot" />Connected</span></div><ChallengeList {...challengeQuery} items={challengeQuery.data?.items} /></Card>}</div>;
}

function RewardCatalogue({ items, isLoading, isError, error }: { items: AdminReward[] | undefined; isLoading: boolean; isError: boolean; error: unknown }) {
  if (isLoading) return <LoadingRows label="Loading reward catalogue" />;
  if (isError) return <StatePanel title="Reward catalogue unavailable" detail={queryMessage(error, "The reward catalogue could not be loaded.")} tone="error" />;
  if (!items?.length) return <EmptyPanel title="No rewards configured" detail="The catalogue endpoint is connected, but no rewards have been created." />;
  return <div className="overflow-hidden rounded-[14px] border" style={{ borderColor: "var(--line)" }}><div className="hidden grid-cols-[1.4fr_.7fr_.6fr_.5fr] gap-3 border-b bg-[var(--hover)] px-4 py-3 text-xs font-medium text-muted sm:grid"><span>Reward</span><span>Type</span><span>Cost</span><span>State</span></div>{items.map((reward) => <div className="grid gap-2 border-b px-4 py-4 last:border-0 sm:grid-cols-[1.4fr_.7fr_.6fr_.5fr] sm:items-center sm:gap-3" style={{ borderColor: "var(--line)" }} key={reward.id}><div><b className="font-medium">{reward.emoji ? `${reward.emoji} ` : ""}{reward.name}</b><p className="mt-0.5 text-xs text-muted">{reward.description || "No description"}</p></div><span className="text-sm text-muted">{labelFor(reward.kind)}</span><span className="text-sm font-medium">{reward.cost} pts</span><span className={`text-sm font-medium ${reward.active ? "text-teal" : "text-muted"}`}>{reward.active ? "Active" : "Paused"}</span></div>)}</div>;
}

function RedemptionList({ items, isLoading, isError, error }: { items: AdminRedemption[] | undefined; isLoading: boolean; isError: boolean; error: unknown }) {
  const mutation = useAdminRedemptionAction();
  const [pending, setPending] = useState<{ redemption: AdminRedemption; action: RedemptionAction; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState("");
  if (isLoading) return <LoadingRows label="Loading redemptions" />;
  if (isError) return <StatePanel title="Redemptions unavailable" detail={queryMessage(error, "The redemption queue could not be loaded.")} tone="error" />;
  if (!items?.length) return <EmptyPanel title="No redemptions yet" detail="The redemption queue is connected, but there are no records to review." />;
  async function submitAction(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!pending || !reason.trim() || reason.trim().length > 500) return; try { await mutation.mutateAsync({ id: pending.redemption.id, action: pending.action, reason: reason.trim() }); setSuccess(`Redemption #${pending.redemption.id} ${pending.action === "fulfill" ? "fulfilled" : "cancelled"}.`); setPending(null); setReason(""); } catch { /* mutation state is shown in the dialog */ } }
  return <><div>{success && <div className="mb-3" role="status"><StatePanel title="Redemption updated" detail={success} tone="success" /></div>}<div className="overflow-hidden rounded-[14px] border" style={{ borderColor: "var(--line)" }}><div className="hidden grid-cols-[1.2fr_.7fr_.6fr_.8fr_1fr] gap-3 border-b bg-[var(--hover)] px-4 py-3 text-xs font-medium text-muted sm:grid"><span>Reward</span><span>Points</span><span>Status</span><span>Requested</span><span>Actions</span></div>{items.map((redemption) => <div className="grid gap-2 border-b px-4 py-4 last:border-0 sm:grid-cols-[1.2fr_.7fr_.6fr_.8fr_1fr] sm:items-center sm:gap-3" style={{ borderColor: "var(--line)" }} key={redemption.id}><div><b className="font-medium">{redemption.rewardName}</b><p className="mt-0.5 text-xs text-muted">Request #{redemption.id} · user {redemption.userId}</p></div><span className="text-sm text-muted">{redemption.cost} pts</span><span className="text-sm font-medium">{labelFor(redemption.status)}</span><span className="text-sm text-muted">{dateLabel(redemption.requestedAt)}</span><div className="flex flex-wrap gap-2">{redemption.status === "requested" && ([ ["fulfill", "Fulfil"], ["cancel", "Cancel"] ] as const).map(([action, label]) => <button key={action} type="button" className="btn btn-small" disabled={mutation.isPending} onClick={() => { mutation.reset(); setPending({ redemption, action, label }); setReason(""); }}>{label}</button>)}</div></div>)}</div></div><Dialog open={!!pending} onClose={() => !mutation.isPending && setPending(null)} className="relative z-50"><div className="fixed inset-0 bg-black/40" aria-hidden="true"/><div className="fixed inset-0 flex items-center justify-center p-4"><DialogPanel className="w-full max-w-lg rounded-2xl border bg-[var(--card)] p-5 shadow-xl" style={{ borderColor: "var(--line)" }}><DialogTitle className="text-lg font-medium">{pending?.label} redemption #{pending?.redemption.id}</DialogTitle><form className="mt-4 space-y-3" onSubmit={submitAction}><label className="block text-sm">Reason <textarea autoFocus required minLength={1} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border bg-transparent p-3" /></label><p className="text-xs text-muted">Required, up to 500 characters.</p>{mutation.isError && <StatePanel title="Update failed" detail={queryMessage(mutation.error, "The redemption could not be updated.")} tone="error" />}<div className="flex justify-end gap-2"><button type="button" className="btn" disabled={mutation.isPending} onClick={() => setPending(null)}>Close</button><button type="submit" className="btn-primary" disabled={mutation.isPending || !reason.trim()}>{mutation.isPending ? "Saving…" : `Confirm ${pending?.label.toLowerCase()}`}</button></div></form></DialogPanel></div></Dialog></>;
}

function RewardsPanel() {
  const [active, setActive] = useState("reward-catalogue");
  const rewardQuery = useAdminRewards(true);
  const redemptionQuery = useAdminRedemptions(true);
  return <div className="stack"><SectionHeading title="Rewards operations" detail="Live catalogue and redemption controls" /><SectionTabs items={rewardItems} active={active} onChange={setActive} />{active === "reward-catalogue" ? <AdminRewardCatalogueManager /> : <Card><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-medium">Redemption queue</h2><p className="mt-1 text-sm text-muted">Fulfil or cancel pending requests with an audited reason.</p></div><span className="pill text-teal border-teal/40"><span className="pill-dot" />Connected</span></div><RedemptionList items={redemptionQuery.data?.items} {...redemptionQuery} /></Card>}</div>;
}

function EngagementPanel() {
  return <div className="stack"><SectionHeading title="Employee engagement" detail="Campaign feedback with accountable responses" /><AdminFeedbackResponses /></div>;
}

function AuditPanel() {
  const [active, setActive] = useState("audit-log");
  const auditQuery = useAdminAudit(active === "audit-log");
  const items = [{ id: "audit-log", label: "Audit log" }, { id: "exports", label: "Exports" }, { id: "operations", label: "Operations evidence" }];
  return <div className="stack"><SectionHeading title="Audit & export" detail="Evidence-first controls" /><SectionTabs items={items} active={active} onChange={setActive} />{active === "audit-log" ? <AuditTable query={auditQuery} /> : active === "operations" ? <AdminOperationsEvidence /> : <Card><h2 className="text-xl font-medium">CSV export</h2><p className="mt-1 text-sm text-muted">Download the bounded audit page for controlled evidence review.</p><a className="btn-primary mt-4 inline-flex" href="/api/admin/audit/export?limit=1000">Download audit CSV</a></Card>}</div>;
}

function AuditTable({ query }: { query: ReturnType<typeof useAdminAudit> }) {
  if (query.isPending) return <LoadingRows label="Loading audit events" />;
  if (query.isError) return <StatePanel title="Audit log unavailable" detail={queryMessage(query.error, "The audit log could not be loaded.")} tone="error" />;
  if (!query.data?.items.length) return <EmptyPanel title="No audit events" detail="No immutable activity has been recorded yet." />;
  return <Card><div className="space-y-2">{query.data.items.map((event: AdminAuditEvent) => <article key={event.id} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><div className="flex flex-wrap items-center gap-2"><span className="pill">{event.action}</span><span className="text-xs text-muted">{dateLabel(event.createdAt)}</span><span className="text-xs text-muted">actor {event.actorUserId ?? "system"}</span></div><p className="mt-1 text-sm text-muted">{event.targetType ?? "event"} {event.targetId ?? ""}{event.reason ? ` · ${event.reason}` : ""}</p></article>)}</div></Card>;
}

function SettingsPanel() {
  return <div className="stack"><SectionHeading title="Platform settings" detail="Change control protected" /><AdminSettingsEditor /></div>;
}

export function AdminWorkspace({ email }: AdminWorkspaceProps) {
  const [activeTab, setActiveTab] = useState(0);
  return <main className="app-background min-h-screen px-4 py-6 sm:px-8 sm:py-10"><div className="mx-auto max-w-[1180px] space-y-6"><OverviewHeader email={email} /><SummaryStrip /><TabGroup selectedIndex={activeTab} onChange={setActiveTab}><TabList className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Admin workspace areas">{workspaceTabs.map((tab) => <Tab key={tab.id} className={({ selected }) => `min-w-fit rounded-[12px] border px-3.5 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sand ${selected ? "border-blue bg-blue text-white" : "border-[var(--line)] bg-[var(--card)] text-muted hover:bg-[var(--hover)]"}`}><span className="block text-sm font-medium">{tab.label}</span><span className={`mt-0.5 block text-xs ${activeTab === workspaceTabs.findIndex((item) => item.id === tab.id) ? "text-white/75" : "text-muted"}`}>{tab.description}</span></Tab>)}</TabList><TabPanels className="pt-1"><TabPanel><GovernancePanel /></TabPanel><TabPanel><PeoplePanel /></TabPanel><TabPanel><LearningPanel /></TabPanel><TabPanel><RewardsPanel /></TabPanel><TabPanel><EngagementPanel /></TabPanel><TabPanel><AuditPanel /></TabPanel><TabPanel><SettingsPanel /></TabPanel></TabPanels></TabGroup><footer className="flex flex-col gap-1 border-t pt-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--line)" }}><span>Protected workspace · no unconfigured writes are exposed</span><span>Admin role required</span></footer></div></main>;
}
