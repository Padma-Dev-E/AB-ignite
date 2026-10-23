"use client";

import Link from "next/link";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { useState, type ReactNode } from "react";
import { Card, IconBox, SectionHeading, StatTile } from "../../../components/ui";
import { useAdminChallenges, useAdminQuizCatalogue, useAdminRedemptions, useAdminRewards } from "../hooks";
import type { AdminChallenge, AdminQuiz, AdminRedemption, AdminReward } from "../types";

type AdminWorkspaceProps = { email: string };
type SubnavItem = { id: string; label: string };

const workspaceTabs = [
  { id: "governance", label: "Governance", description: "Idea control room" },
  { id: "people", label: "People & access", description: "Users and sessions" },
  { id: "learning", label: "Learning", description: "Quizzes and challenges" },
  { id: "rewards", label: "Rewards", description: "Catalogue and redemptions" },
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
  return <div className="grid gap-3 sm:grid-cols-3"><StatTile value="2" label="live read surfaces" /><StatTile value="6" label="governed work areas" /><StatTile value="off" label="write actions in this view" /></div>;
}

function UnconfiguredSection({ title, description, owner }: { title: string; description: string; owner: string }) {
  return <Card className="border-dashed"><div className="flex items-start gap-3"><IconBox tone="sand"><span aria-hidden="true" className="text-lg">◌</span></IconBox><div className="min-w-0"><h2 className="text-xl font-medium">{title}</h2><p className="mt-1 max-w-[680px] text-sm text-muted">{description}</p></div></div><div className="mt-5"><StatePanel title="Not configured" detail={`${owner} is not connected yet. This surface stays read-only until its audited endpoint is available.`} /></div></Card>;
}

function GovernancePanel() {
  const [active, setActive] = useState("screening");
  const copy = {
    screening: ["Screening queue", "Review submitted ideas and their AI screening evidence with traceable decisions.", "Idea screening"],
    transformation: ["Transformation pipeline", "Follow ideas moving from validated opportunity to an accountable delivery path.", "Transformation workflow"],
    evaluation: ["Evaluation workspace", "Compare impact, risk and feasibility evidence before a governed decision.", "Idea evaluation"],
  } as const;
  const [title, description, owner] = copy[active as keyof typeof copy];
  return <div className="stack"><SectionHeading title="Idea governance" detail="Readiness: staged" /><SectionTabs items={governanceItems} active={active} onChange={setActive} /><UnconfiguredSection title={title} description={description} owner={owner} /></div>;
}

function PeoplePanel() {
  const [active, setActive] = useState("users");
  const copy = {
    users: ["Users", "View user lifecycle, account state and ownership once the admin directory endpoint is connected."],
    rbac: ["RBAC", "Review role assignments and capability grants without exposing privilege-changing controls in an unconfigured surface."],
    sessions: ["Sessions", "Inspect active and recent sessions with revocation evidence and last-seen context."],
  } as const;
  const [title, description] = copy[active as keyof typeof copy];
  return <div className="stack"><SectionHeading title="People & access" detail="Protected by admin role" /><SectionTabs items={peopleItems} active={active} onChange={setActive} /><UnconfiguredSection title={title} description={description} owner={`${title} administration`} /></div>;
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
  return <div className="stack"><SectionHeading title="Learning catalogue" detail="Live read-only connections" /><SectionTabs items={learningItems} active={active} onChange={setActive} />{active === "quiz-catalogue" ? <Card><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-medium">Published quizzes</h2><p className="mt-1 text-sm text-muted">Versions and question counts are read from the learning catalogue.</p></div><span className="pill text-teal border-teal/40"><span className="pill-dot" />Connected</span></div><QuizCatalogue {...quizQuery} items={quizQuery.data?.items} /></Card> : <Card><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-medium">Open challenges</h2><p className="mt-1 text-sm text-muted">Active challenges are visible here without exposing join or edit mutations.</p></div><span className="pill text-teal border-teal/40"><span className="pill-dot" />Connected</span></div><ChallengeList {...challengeQuery} items={challengeQuery.data?.items} /></Card>}</div>;
}

function RewardCatalogue({ items, isLoading, isError, error }: { items: AdminReward[] | undefined; isLoading: boolean; isError: boolean; error: unknown }) {
  if (isLoading) return <LoadingRows label="Loading reward catalogue" />;
  if (isError) return <StatePanel title="Reward catalogue unavailable" detail={queryMessage(error, "The reward catalogue could not be loaded.")} tone="error" />;
  if (!items?.length) return <EmptyPanel title="No rewards configured" detail="The catalogue endpoint is connected, but no rewards have been created." />;
  return <div className="overflow-hidden rounded-[14px] border" style={{ borderColor: "var(--line)" }}><div className="hidden grid-cols-[1.4fr_.7fr_.6fr_.5fr] gap-3 border-b bg-[var(--hover)] px-4 py-3 text-xs font-medium text-muted sm:grid"><span>Reward</span><span>Type</span><span>Cost</span><span>State</span></div>{items.map((reward) => <div className="grid gap-2 border-b px-4 py-4 last:border-0 sm:grid-cols-[1.4fr_.7fr_.6fr_.5fr] sm:items-center sm:gap-3" style={{ borderColor: "var(--line)" }} key={reward.id}><div><b className="font-medium">{reward.emoji ? `${reward.emoji} ` : ""}{reward.name}</b><p className="mt-0.5 text-xs text-muted">{reward.description || "No description"}</p></div><span className="text-sm text-muted">{labelFor(reward.kind)}</span><span className="text-sm font-medium">{reward.cost} pts</span><span className={`text-sm font-medium ${reward.active ? "text-teal" : "text-muted"}`}>{reward.active ? "Active" : "Paused"}</span></div>)}</div>;
}

function RedemptionList({ items, isLoading, isError, error }: { items: AdminRedemption[] | undefined; isLoading: boolean; isError: boolean; error: unknown }) {
  if (isLoading) return <LoadingRows label="Loading redemptions" />;
  if (isError) return <StatePanel title="Redemptions unavailable" detail={queryMessage(error, "The redemption queue could not be loaded.")} tone="error" />;
  if (!items?.length) return <EmptyPanel title="No redemptions yet" detail="The redemption queue is connected, but there are no records to review." />;
  return <div className="overflow-hidden rounded-[14px] border" style={{ borderColor: "var(--line)" }}><div className="hidden grid-cols-[1.2fr_.7fr_.6fr_.8fr] gap-3 border-b bg-[var(--hover)] px-4 py-3 text-xs font-medium text-muted sm:grid"><span>Reward</span><span>Points</span><span>Status</span><span>Requested</span></div>{items.map((redemption) => <div className="grid gap-2 border-b px-4 py-4 last:border-0 sm:grid-cols-[1.2fr_.7fr_.6fr_.8fr] sm:items-center sm:gap-3" style={{ borderColor: "var(--line)" }} key={redemption.id}><div><b className="font-medium">{redemption.rewardName}</b><p className="mt-0.5 text-xs text-muted">Request #{redemption.id} · user {redemption.userId}</p></div><span className="text-sm text-muted">{redemption.cost} pts</span><span className="text-sm font-medium">{labelFor(redemption.status)}</span><span className="text-sm text-muted">{dateLabel(redemption.requestedAt)}</span></div>)}</div>;
}

function RewardsPanel() {
  const [active, setActive] = useState("reward-catalogue");
  const rewardQuery = useAdminRewards(true);
  const redemptionQuery = useAdminRedemptions(true);
  return <div className="stack"><SectionHeading title="Rewards operations" detail="Live read-only connections" /><SectionTabs items={rewardItems} active={active} onChange={setActive} />{active === "reward-catalogue" ? <Card><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-medium">Reward catalogue</h2><p className="mt-1 text-sm text-muted">Active state and versioned reward records are visible without edit controls.</p></div><span className="pill text-teal border-teal/40"><span className="pill-dot" />Connected</span></div><RewardCatalogue items={rewardQuery.data} {...rewardQuery} /></Card> : <Card><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-medium">Redemption queue</h2><p className="mt-1 text-sm text-muted">Review status and ownership context before fulfillment controls are enabled.</p></div><span className="pill text-teal border-teal/40"><span className="pill-dot" />Connected</span></div><RedemptionList items={redemptionQuery.data?.items} {...redemptionQuery} /></Card>}</div>;
}

function AuditPanel() {
  const [active, setActive] = useState("audit-log");
  const items = [{ id: "audit-log", label: "Audit log" }, { id: "exports", label: "Exports" }];
  const copy = active === "audit-log" ? ["Audit log", "Review immutable activity evidence with actor, session and network context.", "Audit event query"] : ["Exports", "Create controlled evidence packages with purpose, scope and retention metadata.", "Audit export pipeline"];
  return <div className="stack"><SectionHeading title="Audit & export" detail="Evidence-first controls" /><SectionTabs items={items} active={active} onChange={setActive} /><UnconfiguredSection title={copy[0]} description={copy[1]} owner={copy[2]} /></div>;
}

function SettingsPanel() {
  return <div className="stack"><SectionHeading title="Platform settings" detail="Change control protected" /><UnconfiguredSection title="Settings" description="Review environment, AI, session and notification policies when the configuration endpoint is connected." owner="Platform settings" /></div>;
}

export function AdminWorkspace({ email }: AdminWorkspaceProps) {
  const [activeTab, setActiveTab] = useState(0);
  return <main className="app-background min-h-screen px-4 py-6 sm:px-8 sm:py-10"><div className="mx-auto max-w-[1180px] space-y-6"><OverviewHeader email={email} /><SummaryStrip /><TabGroup selectedIndex={activeTab} onChange={setActiveTab}><TabList className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Admin workspace areas">{workspaceTabs.map((tab) => <Tab key={tab.id} className={({ selected }) => `min-w-fit rounded-[12px] border px-3.5 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sand ${selected ? "border-blue bg-blue text-white" : "border-[var(--line)] bg-[var(--card)] text-muted hover:bg-[var(--hover)]"}`}><span className="block text-sm font-medium">{tab.label}</span><span className={`mt-0.5 block text-xs ${activeTab === workspaceTabs.findIndex((item) => item.id === tab.id) ? "text-white/75" : "text-muted"}`}>{tab.description}</span></Tab>)}</TabList><TabPanels className="pt-1"><TabPanel><GovernancePanel /></TabPanel><TabPanel><PeoplePanel /></TabPanel><TabPanel><LearningPanel /></TabPanel><TabPanel><RewardsPanel /></TabPanel><TabPanel><AuditPanel /></TabPanel><TabPanel><SettingsPanel /></TabPanel></TabPanels></TabGroup><footer className="flex flex-col gap-1 border-t pt-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--line)" }}><span>Protected workspace · no unconfigured writes are exposed</span><span>Admin role required</span></footer></div></main>;
}
