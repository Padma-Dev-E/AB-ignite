"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { ApiError } from "../../../lib/api/client";
import { scorePriority } from "../../../lib/ideas/priority-policy";
import { ideaValidationPasses, normalizeIdeaValidationScore } from "../../../lib/ideas/validation-score";
import type { AppDispatch, RootState } from "../../../store";
import { resetIdeaWizard, setIdeaWizardStep } from "../../../store/ui-slice";
import {
  useAddIdeaComment,
  useCreateIdea,
  useIdea,
  useIdeaAiStatus,
  useIdeaComments,
  useIdeaDevelopment,
  useIdeaPriorityPolicy,
  useIdeas,
  useQueueIdeaDevelopment,
  useSaveIdeaSubmission,
  useSubmitIdea,
  useSupportIdea,
  useUpdateIdea,
  useUpdateIdeaDraft,
} from "../hooks";
import {
  EmployeeFeedbackCampaignForm,
  EmployeeNotificationsPanel,
} from "../../employee/employee-engagement";
import type {
  Idea,
  IdeaCreateInput,
  IdeaEnrichment,
  IdeaKind,
  IdeaPriorityBreakdown,
  IdeaSubmissionInput,
  IdeaValidation,
} from "../types";

import { useEmployeeProfile } from "../../employee/profile-hooks";
import { useLearningChallenges, useLearningRankings } from "../../learning/hooks";

type Page =
  | "community"
  | "new"
  | "learn"
  | "library"
  | "me"
  | "article"
  | "idea"
  | "quiz";

const iconPaths = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M15 6l-6 6 6 6",
  bot: "M12 4v3M6 7h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM9 12v2M15 12v2",
  check: "M5 12l5 5 9-10",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  msg: "M4 5h16v11H9l-5 4z",
  search: "m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  up: "M12 19V6M6 12l6-6 6 6",
} as const;
type IconName = keyof typeof iconPaths;

function Icon({
  name,
  className = "h-[19px] w-[19px]",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

function Avatar({
  name,
  size = "sm",
}: {
  name: string | number;
  size?: "sm" | "md" | "lg";
}) {
  const label = String(name).trim();
  const colors = [
    "#2F80ED",
    "#12A383",
    "#7C5CE0",
    "#E8891C",
    "#DB4C7F",
    "#0E9AD6",
  ];
  const color =
    colors[
      label.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        colors.length
    ];
  const classes = {
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-lg",
  };
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${classes[size]}`}
      style={{ background: color }}
    >
      {label[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

function StatusPill({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "teal" | "sand" | "muted";
}) {
  const tones = {
    blue: "text-blue border-blue/45",
    teal: "text-[#0e9f7a] border-[#0e9f7a]/50",
    sand: "text-sand border-sand/50",
    muted: "text-muted border-[var(--line-strong)]",
  };
  return (
    <span className={`pill ${tones[tone]}`}>
      <span className="pill-dot" />
      {children}
    </span>
  );
}

function StateMessage({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="app-card py-12 text-center">
      <h2 className="text-xl font-medium">{title}</h2>
      {detail && (
        <p className="mx-auto mt-2 max-w-[52ch] text-sm text-muted">{detail}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something went wrong. Please try again.";
}

const leadingSearchNoise = new Set([
  "a", "an", "the", "this", "that", "my", "our", "we", "i", "problem",
  "idea", "proposal", "suggestion", "about", "how", "what", "why", "is",
  "are", "have", "has", "need", "needs", "to", "for", "with",
]);

export function buildIdeaSearchPhrase(text: string) {
  const tokens = text.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? [];
  while (tokens[0] !== undefined && leadingSearchNoise.has(tokens[0])) tokens.shift();
  return tokens.slice(0, 3).join(" ");
}

function priorityRejectionDetails(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 422 || !error.details || typeof error.details !== "object") return null;
  const details = error.details as {
    score?: unknown;
    minimumScore?: unknown;
    priorityBand?: unknown;
    breakdown?: unknown;
  };
  const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  return {
    score: isNumber(details.score) ? details.score : undefined,
    minimumScore: isNumber(details.minimumScore) ? details.minimumScore : undefined,
    priorityBand: typeof details.priorityBand === "string" ? details.priorityBand : undefined,
    breakdown: Array.isArray(details.breakdown)
      ? details.breakdown.filter((item): item is IdeaPriorityBreakdown => {
          if (!item || typeof item !== "object") return false;
          const row = item as Partial<IdeaPriorityBreakdown>;
          return ["turnaround", "volume", "value"].includes(String(row.key)) &&
            isNumber(row.score) && isNumber(row.weight) && isNumber(row.contribution);
        })
      : [],
  };
}

const statusLabels: Record<Idea["status"], string> = {
  draft: "Private draft",
  screening: "Screening", returned: "Returned for changes", business_review: "Business review",
  control_review: "Control review", decision: "Confirmation", poc: "Accepted: proof of concept",
  implementation: "Implementation", implemented: "Impact", rejected: "Rejected", deferred: "Deferred",
};

// Some API versions include author metadata; otherwise retain the real author ID.
function ideaAuthor(idea: Idea) {
  const author = (idea as Idea & { author?: { name: string; department?: string } | null }).author;
  return { name: author?.name || `Contributor #${idea.authorId}`, department: author?.department };
}

function IdeaCard({ idea, onOpen }: { idea: Idea; onOpen: () => void }) {
  const author = ideaAuthor(idea);
  const tone = idea.category.toLowerCase() === "customer" ? "#e94b87" : "#0e9ad6";
  const bandTone =
    idea.priorityBand === "Priority"
      ? "sand"
      : idea.priorityBand === "Quality"
        ? "teal"
        : "muted";
  return (
    <article
      className="app-card border-t-[3px] p-5"
      style={{ borderTopColor: tone }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill border-transparent bg-blue/10 text-blue">{idea.category}</span>
          {idea.priorityBand && <StatusPill tone={bandTone}>{idea.priorityBand}</StatusPill>}
        </div>
        <StatusPill tone={idea.status === "returned" ? "sand" : "blue"}>{statusLabels[idea.status]}</StatusPill>
      </div>
      <button
        onClick={onOpen}
        className="mt-4 text-left text-lg font-semibold leading-snug hover:text-blue"
      >
        {idea.kind === "problem" ? "🔎 " : ""}
        {idea.title}
      </button>
      <p className="mt-2 text-sm text-muted">{idea.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Avatar name={author.name} />
        <span className="flex-1 text-sm">
          <b className="font-medium">{author.name}</b>{" "}
          <span className="text-muted">{author.department}</span>
        </span>
        <span className="font-mono text-xs tracking-[.08em] text-muted">
          {idea.reference}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-small" onClick={onOpen}>
          <Icon name="up" className="h-4 w-4" /> {idea.supports} Support
        </button>
        <button onClick={onOpen} className="btn btn-small">
          <Icon name="msg" className="h-4 w-4" /> {idea.comments} Discuss
        </button>
      </div>
    </article>
  );
}

export function EmployeeCommunityPage({
  onNavigate,
  onOpenIdea,
  points = 0,
}: {
  onNavigate: (page: Page) => void;
  onOpenIdea: (id: number) => void;
  points?: number;
}) {
  const profileQuery = useEmployeeProfile();
  const challengesQuery = useLearningChallenges();
  const rankingsQuery = useLearningRankings("bank");
  const profile = profileQuery.data;
  const rank = rankingsQuery.data?.items.find((item) => item.name === profile?.name && item.department === profile?.department);
  const challenge = challengesQuery.data?.items[0];
  const [showFeedback, setShowFeedback] = useState(false);
  const [filter, setFilter] = useState("Everything");
  const [query, setQuery] = useState("");
  const params = useMemo(
    () => ({
      page: 1,
      pageSize: 20,
      search: query || undefined,
      mine: filter === "Mine",
    }),
    [filter, query],
  );
  const ideasQuery = useIdeas(params);
  const items = useMemo(
    () =>
      (ideasQuery.data?.items ?? []).filter(
        (idea) =>
          filter === "Everything" ||
          filter === "Mine" ||
          (filter === "Ideas" ? idea.kind === "idea" : idea.kind === "problem"),
      ),
    [filter, ideasQuery.data?.items],
  );
  return (
    <div className="stack">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-[26px] font-medium tracking-[-.02em] sm:text-[32px]">
            Hello{profile?.name ? `, ${profile.name}` : ""} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1.5 text-base text-muted">
            Your next idea could improve how we serve customers and each other.
          </p>
          <button
            className="btn-primary mt-4"
            onClick={() => onNavigate("new")}
          >
            <Icon name="spark" /> Share an idea
          </button>
        </div>
        <div className="hero-surface rounded-[18px] p-5 text-white shadow-[0_18px_36px_-18px_var(--blue-deep)] w-full shrink-0 sm:w-[340px]">
          <div className="text-xs font-medium tracking-[.14em]">
            AB IGNITE
          </div>
          <div className="mt-4 h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-500" aria-hidden="true" />
          <div className="mt-4 text-[36px] font-semibold leading-none">
            💡 {points.toLocaleString("en-US")}
          </div>
          <div className="mt-1 text-xs text-white/80">
            Ignite account balance, in points
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-2 text-xs text-white/80">
            <span>{profile?.name ?? "Your Ignite account"}</span>
            {rank && <span>Rank {rank.rank} this season</span>}
          </div>
        </div>
      </div>
      <section className="hero-surface overflow-hidden rounded-[24px] p-6 text-white shadow-lg sm:p-8" aria-label="Feedback campaign">
        <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>div]:shadow-none [&_h2]:text-2xl [&_p]:text-white/85 [&_span]:text-white [&_.field-label]:text-white [&_input]:text-ink [&_textarea]:text-ink [&_select]:text-ink [&_form]:rounded-xl [&_form]:bg-white/10 [&_form]:p-4">
          <button className="mb-4 rounded-lg border border-white/50 px-4 py-2 text-sm font-medium" aria-expanded={showFeedback} onClick={() => setShowFeedback((value) => !value)}>
            <span className="inline-flex items-center gap-2"><Icon name="msg" />{showFeedback ? "Close feedback form" : "Share Your Feedback"}</span>
          </button>
          <div className={showFeedback ? "" : "[&_form]:hidden"}><EmployeeFeedbackCampaignForm /></div>
        </div>
      </section>
      <div className="grid items-stretch gap-5 md:grid-cols-2">
        <section className="app-card">
          <h2 className="text-xl font-semibold">Happening now</h2>
          <div className="mt-5 divide-y divide-[var(--line)]">
            <div className="pb-5">
              <h3 className="font-medium">{challenge?.title ?? "Challenge of the month"}</h3>
              {challengesQuery.isPending ? <p role="status" className="mt-2 text-sm text-muted">Loading challenges…</p> : challengesQuery.isError ? <p role="alert" className="mt-2 text-sm text-muted">{errorMessage(challengesQuery.error)} <button className="underline" onClick={() => void challengesQuery.refetch()}>Retry</button></p> : challenge ? <><p className="mt-1 text-sm leading-6 text-muted">{challenge.question}</p><p className="mt-2 text-xs text-muted">{challenge.participants} participants · closes {new Date(challenge.deadlineAt).toLocaleDateString()}</p><button className="btn btn-small mt-3" onClick={() => onNavigate("new")}>Share an idea</button></> : <p className="mt-2 text-sm text-muted">No open challenges right now.</p>}
            </div>
            <div className="py-5"><h3 className="font-medium">Grow your knowledge</h3><p className="mt-1 text-sm leading-6 text-muted">Find out where you stand and get reading picked for you.</p><button className="btn btn-small mt-3" onClick={() => onNavigate("learn")}>Take a quiz</button></div>
            <div className="pt-5"><h3 className="font-medium">Season ranking</h3><p className="mt-1 text-sm text-muted">{rank ? `You are ranked ${rank.rank} across the bank.` : rankingsQuery.isPending ? "Loading ranking…" : rankingsQuery.isError ? "Ranking is temporarily unavailable." : "Explore the bank’s innovation champions."}</p><button className="btn btn-small mt-3" onClick={() => onNavigate("learn")}>See the ranking</button></div>
          </div>
        </section>
        <section className="app-card" aria-label="What’s new"><h2 className="mb-4 text-xl font-semibold">What’s new</h2><div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>div]:shadow-none [&_h2]:sr-only"><EmployeeNotificationsPanel /></div></section>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Ideas from across the bank</h2><span className="text-sm text-muted">{ideasQuery.data ? `${ideasQuery.data.total} shared` : "Community ideas"}</span></div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border bg-white p-1"
          style={{ borderColor: "var(--line)" }}
        >
          {["Everything", "Ideas", "Problems", "Mine"].map((item) => (
            <button
              key={item}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
              className={`whitespace-nowrap rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium ${filter === item ? "bg-blue text-white" : "text-muted hover:bg-[var(--hover)]"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="flex min-w-[220px] flex-1 items-center gap-2">
          <span className="sr-only">Search ideas</span>
          <span className="relative flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-3 h-4 w-4 text-muted"
            />
            <input
              className="input pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ideas, people or references"
            />
          </span>
        </label>
      </div>
      <p className="-mt-3 flex items-center gap-2 text-sm text-muted">
        <Icon name="lock" className="h-4 w-4" />
        Every idea is registered to its author. You support colleagues’ ideas,
        not your own.
      </p>
      {ideasQuery.isPending ? (
        <StateMessage
          title="Loading ideas…"
          detail="Getting the latest community proposals."
        />
      ) : ideasQuery.isError ? (
        <StateMessage
          title="Ideas are temporarily unavailable"
          detail={errorMessage(ideasQuery.error)}
          action={
            <button className="btn" onClick={() => void ideasQuery.refetch()}>
              Try again
            </button>
          }
        />
      ) : items.length === 0 ? (
        <StateMessage
          title="No ideas found"
          detail={
            query
              ? "Try a different search or clear the filter."
              : "Be the first to share an idea with the community."
          }
          action={
            <button className="btn-primary" onClick={() => onNavigate("new")}>
              Share an idea
            </button>
          }
        />
      ) : (
        <div className="grid gap-[18px] xl:grid-cols-2">
          {items.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onOpen={() => onOpenIdea(idea.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const questionPrompts = [
  "Who experiences this problem today?",
  "What happens today?",
  "What is needed to make this work?",
  "What could make the proposal difficult?",
  "How would you know the change worked?",
];
const developFields = [
  {
    key: "problem",
    label: "Problem statement",
    placeholder: "What problem are you solving?",
  },
  {
    key: "solution",
    label: "Proposed solution",
    placeholder: "What would you change?",
  },
  {
    key: "benefits",
    label: "Expected benefits",
    placeholder: "Who benefits and how?",
  },
  {
    key: "risks",
    label: "Possible risks",
    placeholder: "What should reviewers think about?",
  },
] as const;

function IdeaStepBar({ step }: { step: number }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 overflow-hidden sm:gap-2">
      {["Describe", "Develop", "Questions", "Pass or fail", "Numbers"].map(
        (label, index) => (
          <div
            key={label}
            className={`flex items-center gap-2 rounded-[11px] border px-2.5 py-2.5 text-[13px] font-medium ${step === index + 1 ? "border-blue bg-blue/[.12] text-ink" : step > index + 1 ? "text-muted" : "text-[var(--dim)]"}`}
            style={{
              borderColor: step === index + 1 ? "var(--blue)" : "var(--line)",
            }}
          >
            <b
              className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-xs ${step > index + 1 ? "border-[#0e9f7a] text-[#0e9f7a]" : step === index + 1 ? "border-blue bg-blue text-white" : ""}`}
              style={{
                borderColor:
                  step > index + 1 || step === index + 1
                    ? undefined
                    : "var(--line-strong)",
              }}
            >
              {step > index + 1 ? "✓" : index + 1}
            </b>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ),
      )}
    </div>
  );
}

export function EmployeeIdeaSubmissionPage({
  onOpenIdea,
}: {
  onOpenIdea: (id: number) => void;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const step = useSelector((state: RootState) => state.ui.ideaWizardStep);
  const [kind, setKind] = useState<IdeaKind>("idea");
  const [raw, setRaw] = useState("");
  const [resumeDraftId, setResumeDraftId] = useState<number | null>(null);
  const savedDraftsQuery = useIdeas({ page: 1, pageSize: 50, mine: true });
  const savedDrafts = (savedDraftsQuery.data?.items ?? []).filter((idea) => idea.status === "draft");
  const resumeDraftQuery = useIdea(resumeDraftId ?? 0, Boolean(resumeDraftId));
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const rawSearch = buildIdeaSearchPhrase(raw).slice(0, 120);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(rawSearch), 400);
    return () => clearTimeout(timer);
  }, [rawSearch]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({
    problem: "",
    solution: "",
    benefits: "",
    risks: "",
  });
  const [answers, setAnswers] = useState<string[]>(() =>
    questionPrompts.map(() => ""),
  );
  const [impact, setImpact] = useState({
    turnaround: "",
    volume: "",
    value: "",
  });
  const [buildsOnId, setBuildsOnId] = useState<number | undefined>();
  const [differentiation, setDifferentiation] = useState("");
  const [metricExplanations, setMetricExplanations] = useState({
    turnaround: "",
    volume: "",
    value: "",
  });
  const [created, setCreated] = useState<{
    idea: Idea;
    versionId: number;
  } | null>(null);
  const [submitResult, setSubmitResult] = useState<
    import("../types").IdeaSubmitResponse | null
  >(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitForHumanReview, setSubmitForHumanReview] = useState(false);
  const [developmentError, setDevelopmentError] = useState<string | null>(null);
  const [appliedRunId, setAppliedRunId] = useState<number | null>(null);
  const validationSnapshot = useRef<string | null>(null);
  const [validatedContent, setValidatedContent] = useState<string | null>(null);
  const createMutation = useCreateIdea();
  const draftMutation = useUpdateIdeaDraft();
  const developmentMutation = useQueueIdeaDevelopment();
  const saveSubmissionMutation = useSaveIdeaSubmission();
  const submitMutation = useSubmitIdea();
  const priorityPolicyQuery = useIdeaPriorityPolicy();
  const busy =
    createMutation.isPending ||
    saveSubmissionMutation.isPending ||
    submitMutation.isPending;
  const searchMatches = rawSearch === debouncedSearch;
  const candidateQuery = useIdeas({
    page: 1,
    pageSize: 5,
    search: debouncedSearch.length >= 4 ? debouncedSearch : undefined,
  }, searchMatches && debouncedSearch.length >= 4);
  const unresolvedOriginality = Boolean(
    searchMatches &&
    (candidateQuery.data?.items.length ?? 0) > 0 &&
    !buildsOnId &&
    differentiation.trim().length < 20,
  );
  const aiStatusQuery = useIdeaAiStatus(
    created?.idea.id ?? 0,
    Boolean(created && submitResult && !submitResult.submitted),
  );
  const developmentQuery = useIdeaDevelopment(
    created?.idea.id ?? 0,
    Boolean(created),
  );
  const allIdeaRuns = developmentQuery.data?.runs ?? [];
  const currentRuns = allIdeaRuns.filter(
    (run) => run.ideaVersionId === created?.versionId,
  );
  const enrichmentRun = currentRuns.find((run) => run.jobKey === "idea.enrich");
  const validationRun = currentRuns.find(
    (run) => run.jobKey === "idea.validate",
  );
  const enrichment =
    enrichmentRun?.status === "succeeded"
      ? (enrichmentRun.result as (IdeaEnrichment & { solutionStatement?: string; riskStatement?: string }) | null)
      : null;
  const validation =
    validationRun?.status === "succeeded"
      ? (validationRun.result as IdeaValidation | null)
      : null;
  const validationScore = normalizeIdeaValidationScore(validation?.overallScore);
  const validationPassed = ideaValidationPasses(validation);
  const lowValidationVersions = new Set(allIdeaRuns.flatMap((run) => {
    if (run.jobKey !== "idea.validate" || run.status !== "succeeded" || run.ideaVersionId <= 0) return [];
    const result = run.result as IdeaValidation | null;
    const score = normalizeIdeaValidationScore(result?.overallScore);
    return score !== null && score <= 7 ? [run.ideaVersionId] : [];
  }));
  const currentContent = JSON.stringify({ kind, raw, title, summary, details });
  const validationIsCurrent = Boolean(
    validationRun &&
    created &&
    validationRun.ideaVersionId === created.versionId &&
    validatedContent === currentContent,
  );
  const canSubmitForHumanReview = Boolean(validationIsCurrent && validationScore !== null && validationScore <= 7 && lowValidationVersions.size >= 2);
  const validationBlocked = !validationIsCurrent || (!validationPassed && !canSubmitForHumanReview);
  const metrics = {
    turnaround: Number(impact.turnaround),
    volume: Number(impact.volume),
    value: Number(impact.value),
  };
  const hasAllImpactValues = Object.values(impact).every((value) => value.trim().length > 0);
  const validImpactValues = hasAllImpactValues && Object.values(metrics).every((value) => Number.isFinite(value) && value >= 0 && value <= 3);
  const priorityResult = validImpactValues && priorityPolicyQuery.data
    ? scorePriority(metrics, priorityPolicyQuery.data)
    : null;
  const submissionInput: IdeaSubmissionInput = {
    answers: {
      beneficiaries: answers[0],
      currentProcess: answers[1],
      needed: answers[2],
      risks: answers[3],
      successMeasure: answers[4],
    },
    metrics: {
      ...metrics,
      turnaroundExplanation: metricExplanations.turnaround || undefined,
      volumeExplanation: metricExplanations.volume || undefined,
      valueExplanation: metricExplanations.value || undefined,
    },
    buildsOnId,
    differentiation: differentiation.trim() || undefined,
  };
  const fieldsValid =
    title.trim().length >= 3 &&
    summary.trim().length >= 10 &&
    answers.every((answer) => answer.trim().length > 0) &&
    Object.values(impact).every((value) => value.trim().length > 0) &&
    [metrics.turnaround, metrics.volume, metrics.value].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 3,
    );
  const serverValidation = saveSubmissionMutation.data;
  const submissionError = saveSubmissionMutation.error ?? submitMutation.error;
  const submissionRejection = priorityRejectionDetails(submissionError);
  const priorityScoreRejected = submissionRejection?.score !== undefined || submissionRejection?.minimumScore !== undefined;

  useEffect(() => {
    dispatch(resetIdeaWizard());
  }, [dispatch]);

  useEffect(() => {
    const detail = resumeDraftQuery.data;
    if (!resumeDraftId || !detail || detail.idea.id !== resumeDraftId) return;
    const { idea, submission } = detail;
    setKind(idea.kind);
    setRaw(idea.summary);
    setTitle(idea.title);
    setSummary(idea.summary);
    setDetails({
      problem: idea.problem ?? "",
      solution: idea.solution ?? "",
      benefits: idea.benefits ?? "",
      risks: idea.risks ?? "",
    });
    setBuildsOnId(idea.buildsOnId ?? undefined);
    if (submission) {
      setAnswers([
        submission.answers.beneficiaries,
        submission.answers.currentProcess,
        submission.answers.needed,
        submission.answers.risks,
        submission.answers.successMeasure,
      ]);
      setImpact({
        turnaround: String(submission.metrics.turnaround),
        volume: String(submission.metrics.volume),
        value: String(submission.metrics.value),
      });
      setMetricExplanations({
        turnaround: submission.metrics.turnaroundExplanation ?? "",
        volume: submission.metrics.volumeExplanation ?? "",
        value: submission.metrics.valueExplanation ?? "",
      });
      setDifferentiation(submission.differentiation ?? "");
    }
    setCreated({ idea, versionId: 0 });
    setAppliedRunId(null);
    setValidatedContent(null);
    setResumeDraftId(null);
    dispatch(setIdeaWizardStep(2));
  }, [dispatch, resumeDraftId, resumeDraftQuery.data]);

  useEffect(() => {
    if (!enrichment || !enrichmentRun || appliedRunId === enrichmentRun.id)
      return;
    setTitle((current) => current.trim() ? current : enrichment.suggestedTitle);
    setSummary((current) => current.trim() ? current : enrichment.conciseSummary);
    setDetails((current) => ({
      ...current,
      problem: current.problem.trim() ? current.problem : enrichment.problemStatement,
      benefits: current.benefits.trim() ? current.benefits : enrichment.valueStatement,
      solution: current.solution.trim() ? current.solution : (enrichment.solutionStatement ?? current.solution),
      risks: current.risks.trim() ? current.risks : (enrichment.riskStatement ?? current.risks),
    }));
    setAppliedRunId(enrichmentRun.id);
  }, [appliedRunId, enrichment, enrichmentRun]);
  useEffect(() => {
    if (
      validationRun?.status === "succeeded" &&
      validation &&
      created &&
      validationRun.ideaVersionId === created.versionId
    ) {
      setValidatedContent(validationSnapshot.current);
    }
  }, [created, currentContent, validation, validationRun]);
  const applyEnrichment = () => {
    if (!enrichment || !enrichmentRun) return;
    setTitle(enrichment.suggestedTitle);
    setSummary(enrichment.conciseSummary);
    setDetails((current) => ({
      ...current,
      problem: enrichment.problemStatement,
      benefits: enrichment.valueStatement,
      solution: enrichment.solutionStatement ?? current.solution,
      risks: enrichment.riskStatement ?? current.risks,
    }));
    setAppliedRunId(enrichmentRun.id);
  };

  const nextFromDescribe = () => {
    if (raw.trim().length < 10) return;
    if (!title.trim()) setTitle(raw.trim().split("\n")[0].slice(0, 120));
    if (!summary.trim()) setSummary(raw.trim());
    if (!details[kind === "problem" ? "problem" : "solution"].trim()) {
      setDetails((current) => ({ ...current, [kind === "problem" ? "problem" : "solution"]: raw.trim() }));
    }
    dispatch(setIdeaWizardStep(2));
  };
  const draftInput = (): IdeaCreateInput => ({
    kind,
    title: title.trim(),
    summary: summary.trim(),
    category: "Customer",
    problem: details.problem.trim() || undefined,
    solution: details.solution.trim() || undefined,
    benefits: details.benefits.trim() || undefined,
    risks: details.risks.trim() || undefined,
    dataClassification: "internal",
    buildsOnId,
    differentiation: differentiation.trim() || undefined,
  });
  const syncDraft = async () => {
    if (!created) {
      const result = await createMutation.mutateAsync(draftInput());
      setCreated(result);
      return result;
    }
    if ((buildsOnId ?? null) !== created.idea.buildsOnId)
      throw new Error(
        "The related idea changed after this draft was saved. Keep the original selection for this draft.",
      );
    const updated = await draftMutation.mutateAsync({
      id: created.idea.id,
      input: {
        kind,
        title: title.trim(),
        summary: summary.trim(),
        category: "Customer",
        problem: details.problem.trim() || null,
        solution: details.solution.trim() || null,
        benefits: details.benefits.trim() || null,
        risks: details.risks.trim() || null,
        dataClassification: "internal",
      },
    });
    const result = { idea: updated.idea, versionId: updated.versionId };
    setCreated(result);
    return result;
  };
  const requestDevelopment = async (action: "enrich" | "validate") => {
    if (title.trim().length < 3 || summary.trim().length < 10) return;
    setDevelopmentError(null);
    try {
      if (action === "validate") {
        validationSnapshot.current = currentContent;
        setValidatedContent(null);
      }
      const draft = await syncDraft();
      await developmentMutation.mutateAsync({ id: draft.idea.id, action });
    } catch (error) {
      setDevelopmentError(errorMessage(error));
    }
  };
  const finishSubmit = async (id: number, versionId: number, humanReview = submitForHumanReview) => {
    try {
      const result = await submitMutation.mutateAsync({ id, versionId, submitForHumanReview: humanReview });
      setSubmitResult(result);
    } catch (error) {
      setSubmitError(error);
    }
  };
  useEffect(() => {
    if (
      !created ||
      !submitResult ||
      submitResult.submitted ||
      submitError ||
      submitMutation.isPending
    )
      return;
    const preflight = aiStatusQuery.data?.runs.find(
      (run) => run.jobKey === "idea.preflight",
    );
    if (preflight?.status === "succeeded")
      void finishSubmit(created.idea.id, created.versionId, submitForHumanReview).catch(
        () => undefined,
      );
  }, [
    aiStatusQuery.data,
    created,
    submitResult,
    submitError,
    submitMutation.isPending,
    submitForHumanReview,
  ]);
  const submit = async (humanReview = false) => {
    if (
      !fieldsValid ||
      busy ||
      !validationIsCurrent ||
      (!validationPassed && !(humanReview && canSubmitForHumanReview)) ||
      (candidateQuery.data?.items.some((item) => item.id !== buildsOnId) &&
        !buildsOnId &&
        differentiation.trim().length < 20)
    )
      return;
    try {
      const result = await syncDraft();
      setSubmitForHumanReview(humanReview);
      await saveSubmissionMutation.mutateAsync({
        id: result.idea.id,
        input: submissionInput,
      });
      setCreated(result);
      await finishSubmit(result.idea.id, result.versionId, humanReview);
    } catch {
      /* the mutation error is rendered below */
    }
  };
  if (created && submitResult) {
    const preflight = aiStatusQuery.data?.runs.find(
      (run) => run.jobKey === "idea.preflight",
    );
    const completed = Boolean(submitResult?.submitted);
    const failed = Boolean(
      submitError ||
      (preflight &&
        ["failed", "timed_out", "cancelled"].includes(preflight.status)),
    );
    return (
      <div className="stack">
        <section className="app-card py-14 text-center">
          <div
            className="icon-box mx-auto mb-3"
            style={{
              color: completed
                ? "var(--teal)"
                : failed
                  ? "#d6336c"
                  : "var(--blue)",
              background: completed
                ? "rgba(14,159,122,.12)"
                : "rgba(47,128,237,.12)",
            }}
          >
            <Icon name={completed ? "check" : "bot"} />
          </div>
          <h1 className="text-2xl font-medium">
            {completed
              ? "Idea submitted"
              : failed
                ? "Validation needs attention"
                : "Idea received — validation queued"}
          </h1>
          <p className="mx-auto mt-2 max-w-[52ch] text-muted">
            {completed ? (
              <>
                Your idea is registered as{" "}
                <b>{submitResult?.reference ?? created.idea.reference}</b>. An
                innovation reviewer screens it first, and you are notified at
                every step.
              </>
            ) : failed ? (
              "The server could not complete validation or submission. Your idea is saved; review the message and try again if appropriate."
            ) : (
              `Reference ${created.idea.reference}. The server is checking your idea before it is submitted.`
            )}
          </p>
          {completed && (
            <div
              className="mx-auto mt-5 max-w-2xl text-left"
              aria-label="Submission details"
            >
              <div className="grid gap-3 sm:grid-cols-5">
                <div className="tile">
                  <span className="block text-xs text-muted">Category</span>
                  <b>{submitResult.category ?? created.idea.category}</b>
                </div>
                {typeof submitResult.pointsAwarded === "number" && (
                  <div className="tile">
                    <span className="block text-xs text-muted">Points earned</span>
                    <b>{submitResult.pointsAwarded} points</b>
                  </div>
                )}
                <div className="tile">
                  <span className="block text-xs text-muted">
                    Priority band
                  </span>
                  <b>{submitResult.priorityBand ?? "—"}</b>
                </div>
                <div className="tile">
                  <span className="block text-xs text-muted">
                    Score / minimum
                  </span>
                  <b>
                    {submitResult.score?.toFixed(2) ?? "—"} /{" "}
                    {submitResult.minimumScore?.toFixed(2) ?? "—"}
                  </b>
                </div>
                <div className="tile">
                  <span className="block text-xs text-muted">AI validation</span>
                  <b>{submitResult.aiValidationScore?.toFixed(1) ?? "—"} / 10</b>
                  {submitResult.submittedWithLowAiScore && <span className="mt-1 block text-xs text-sand">Submitted for human review</span>}
                </div>
              </div>
              {submitResult.submittedWithLowAiScore && <p className="mt-3 rounded-xl border border-sand/40 bg-sand/5 p-3 text-sm">Your idea entered the normal review queue after two below-threshold AI validation results. A reviewer will assess it manually.</p>}
              {submitResult.breakdown && (
                <div
                  className="mt-3 rounded-xl border p-4 text-sm"
                  style={{ borderColor: "var(--line)" }}
                >
                  <p className="font-medium">KPI breakdown</p>
                  <div className="mt-2 space-y-2">
                    {submitResult.breakdown.map((item) => (
                      <div
                        className="flex justify-between gap-3"
                        key={item.key}
                      >
                        <span className="capitalize">
                          {item.key} · {Math.round(item.weight * 100)}% weight
                        </span>
                        <span>
                          {item.score.toFixed(1)} →{" "}
                          {item.contribution.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {!completed && !failed && (
            <p className="mt-3 text-sm text-muted" aria-live="polite">
              {submitMutation.isPending ||
              preflight?.status === "queued" ||
              preflight?.status === "running"
                ? "Checking originality and safety…"
                : "Waiting for the preflight result…"}
            </p>
          )}
          {(aiStatusQuery.isError || Boolean(submitError)) && (
            <p
              className="mx-auto mt-3 max-w-[52ch] text-sm text-[#d6336c]"
              role="alert"
            >
              {errorMessage(aiStatusQuery.error ?? submitError)}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {failed && preflight?.status === "succeeded" && <button className="btn" type="button" disabled={submitMutation.isPending} onClick={() => setSubmitError(null)}>{submitMutation.isPending ? "Retrying…" : "Retry submission"}</button>}
            {failed && preflight?.status !== "succeeded" && <button className="btn" type="button" onClick={() => { setSubmitResult(null); setSubmitError(null); dispatch(setIdeaWizardStep(2)); }}>Improve draft</button>}
            {completed && (
              <button
                className="btn"
                onClick={() => onOpenIdea(created.idea.id)}
              >
                View idea
              </button>
            )}
            {(failed || completed) && (
              <button
                className="btn-primary"
                onClick={() => {
                  setCreated(null);
                  setSubmitResult(null);
                  setSubmitError(null);
                  setRaw("");
                  setTitle("");
                  setSummary("");
                  setDetails({
                    problem: "",
                    solution: "",
                    benefits: "",
                    risks: "",
                  });
                  setAnswers(questionPrompts.map(() => ""));
                  setImpact({ turnaround: "", volume: "", value: "" });
                  dispatch(resetIdeaWizard());
                }}
              >
                Share another idea
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="stack">
      <section className="hero-surface relative overflow-hidden rounded-[24px] px-5 py-6 text-white sm:px-7 sm:py-[30px]">
        <div className="relative z-10 max-w-[62%]">
          <h1 className="text-[25px] font-medium leading-tight tracking-[-.02em] sm:text-[32px]">
            Share an idea
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-white/85 sm:text-[15px]">
            Turn a customer or colleague insight into a clear proposal the bank
            can act on.
          </p>
        </div>
      </section>
      <IdeaStepBar step={step} />
      {step === 2 && (
        <section className="app-card" aria-label="AI development suggestions">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Develop your idea</h2>
              <p className="mt-1 text-sm text-muted">
                Review and edit the structured fields. AI suggestions fill empty
                fields when available; you can complete them manually.
              </p>
            </div>
            <button
              className="btn"
              disabled={
                title.trim().length < 3 ||
                summary.trim().length < 10 ||
                createMutation.isPending ||
                draftMutation.isPending ||
                developmentMutation.isPending
              }
              onClick={() => void requestDevelopment("enrich")}
            >
              {createMutation.isPending ||
              draftMutation.isPending ||
              developmentMutation.isPending
                ? "Preparing…"
                : "Suggest improvements"}
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="field-label">Idea title</span>
              <input
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="field-label">Summary</span>
              <textarea
                className="input min-h-[90px]"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </label>
            {developFields.map((field) => (
              <label key={field.key} className="block">
                <span className="field-label">{field.label}</span>
                <textarea
                  className="input min-h-[100px]"
                  value={details[field.key]}
                  onChange={(event) =>
                    setDetails((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          {created && developmentQuery.isPending && (
            <p className="mt-3 text-sm text-muted" aria-live="polite">
              Loading AI suggestions…
            </p>
          )}
          {enrichmentRun &&
            ["queued", "running"].includes(enrichmentRun.status) && (
              <p className="mt-3 text-sm text-muted" aria-live="polite">
                AI is developing suggestions for your draft…
              </p>
            )}
          {enrichmentRun &&
            ["failed", "timed_out", "cancelled"].includes(
              enrichmentRun.status,
            ) && (
              <p className="mt-3 text-sm text-[#d6336c]" role="alert">
                Suggestions could not be completed. Complete the structure
                manually.
              </p>
            )}
          {enrichment && (
            <>
              <p className="mt-3 text-sm text-muted">
                AI suggestions were added to empty fields; all fields remain
                editable.
              </p>
              <button className="btn mt-2" onClick={applyEnrichment}>
                {appliedRunId === enrichmentRun?.id
                  ? "Reapply suggestions"
                  : "Apply suggestions"}
              </button>
            </>
          )}
          {developmentQuery.isError && (
            <p className="mt-3 text-sm text-[#d6336c]" role="alert">
              {errorMessage(developmentQuery.error)}{" "}
              <button
                className="underline"
                onClick={() => void developmentQuery.refetch()}
              >
                Retry
              </button>
            </p>
          )}
          {developmentError && (
            <p className="mt-3 text-sm text-[#d6336c]" role="alert">
              {errorMessage(developmentError)}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" type="button" onClick={() => dispatch(setIdeaWizardStep(1))}>Back to describe</button>
            <button className="btn-primary" type="button" disabled={title.trim().length < 3 || summary.trim().length < 10 || developmentMutation.isPending} onClick={() => dispatch(setIdeaWizardStep(3))}>Continue to questions</button>
          </div>
        </section>
      )}
      {step === 3 && (
        <section className="app-card" aria-label="Reviewer questions">
          <div className="flex items-start gap-3">
            <div className="icon-box"><Icon name="bot" /></div>
            <div>
              <h2 className="text-lg font-medium">Questions reviewers may ask</h2>
              <p className="mt-1 text-muted">Answer each prompt so the reviewer can understand the context and measure the outcome.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {questionPrompts.map((prompt, index) => <label key={prompt} className="block rounded-xl border-l-2 px-3 py-1" style={{ borderColor: "var(--line-strong)" }}><span className="font-medium">{prompt}</span><textarea className="input mt-2 min-h-[76px]" value={answers[index]} onChange={(event) => setAnswers((current) => current.map((answer, itemIndex) => itemIndex === index ? event.target.value : answer))} placeholder="Your answer" /></label>)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" type="button" onClick={() => dispatch(setIdeaWizardStep(2))}>Back to develop</button>
            <button className="btn-primary" type="button" disabled={!answers.every((answer) => answer.trim().length > 0)} onClick={() => dispatch(setIdeaWizardStep(4))}>Continue to validation</button>
          </div>
        </section>
      )}
      {step === 4 && (
        <section className="app-card" aria-label="AI validation">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">AI validation</h2>
              <p className="mt-1 text-sm text-muted">
                An AI score above 7/10 lets you continue to numbers. A score
                of 7/10 or below needs an improved draft and another check.
              </p>
            </div>
            <button
              className="btn"
              disabled={
                title.trim().length < 3 ||
                summary.trim().length < 10 ||
                createMutation.isPending ||
                draftMutation.isPending ||
                developmentMutation.isPending
              }
              onClick={() => void requestDevelopment("validate")}
            >
              {createMutation.isPending ||
              draftMutation.isPending ||
              developmentMutation.isPending
                ? "Preparing…"
                : "Check with AI"}
            </button>
          </div>
          {created && developmentQuery.isPending && (
            <p className="mt-3 text-sm text-muted" aria-live="polite">
              Loading validation…
            </p>
          )}
          {validationRun &&
            ["queued", "running"].includes(validationRun.status) && (
              <p className="mt-3 text-sm text-muted" aria-live="polite">
                AI is reviewing the current draft…
              </p>
            )}
          {validationRun &&
            ["failed", "timed_out", "cancelled"].includes(
              validationRun.status,
            ) && (
              <p className="mt-3 text-sm text-[#d6336c]" role="alert">
                AI validation could not be completed. You must run validation
                successfully before submission.
              </p>
            )}
          {validation && (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <b>Validation {validationPassed ? "passed" : "failed"}:</b>{" "}
                {validationScore === null ? "Score unavailable" : `${validationScore}/10`} ·{" "}
                {validation.decision.replaceAll("_", " ")}
              </p>
              {validation.decision === "needs_human_review" && (
                <p>AI recommends human review. This remains advisory; the separate safety check still applies when you submit.</p>
              )}
              {validation.strengths.length > 0 && (
                <p>
                  <b>Strengths:</b> {validation.strengths.join("; ")}
                </p>
              )}
              {validation.gaps.length > 0 && (
                <p>
                  <b>Validation reasons:</b> {validation.gaps.join("; ")}
                </p>
              )}
              {validation.questions.length > 0 && (
                <p>
                  <b>Questions:</b>{" "}
                  {validation.questions.map((item) => item.question).join("; ")}
                </p>
              )}
              {validation.risks.length > 0 && (
                <p>
                  <b>Risks:</b>{" "}
                  {validation.risks.map((item) => item.description).join("; ")}
                </p>
              )}
              {!validationPassed && (
                <p className="text-[#d6336c]" role="alert">
                  {validationScore === null
                    ? "Validation returned no usable score. Run validation again before continuing."
                    : `Your score is ${validationScore}/10; the AI validation threshold is above 7/10. Improve the draft and run validation again. After two below-threshold results on different draft versions, you can submit it for human review.`}
                </p>
              )}
            </div>
          )}
          {validationRun?.status === "succeeded" && !validationIsCurrent && (
            <p className="mt-3 text-sm text-[#d6336c]" role="alert">
              This result belongs to an older draft. Run validation again for
              the current version.
            </p>
          )}
          {developmentQuery.isError && (
            <p className="mt-3 text-sm text-[#d6336c]" role="alert">
              {errorMessage(developmentQuery.error)}{" "}
              <button
                className="underline"
                onClick={() => void developmentQuery.refetch()}
              >
                Retry
              </button>
            </p>
          )}
          {developmentError && (
            <p className="mt-3 text-sm text-[#d6336c]" role="alert">
              {developmentError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" type="button" onClick={() => dispatch(setIdeaWizardStep(3))}>Back to questions</button>
            {validation && !validationPassed && <button className="btn" type="button" onClick={() => dispatch(setIdeaWizardStep(2))}>Improve draft</button>}
            {canSubmitForHumanReview
              ? <button className="btn-primary" type="button" onClick={() => dispatch(setIdeaWizardStep(5))}>Continue to human review submission</button>
              : <button className="btn-primary" type="button" disabled={!validationIsCurrent || !validationPassed} onClick={() => dispatch(setIdeaWizardStep(5))}>Continue to numbers</button>}
          </div>
        </section>
      )}
      {step === 5 && (
        <section className="app-card" aria-label="Impact numbers">
          <h2 className="text-lg font-medium">Add impact numbers</h2>
          <p className="mt-1 text-muted">Rough estimates are enough. Reviewers will refine them later.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {(["turnaround", "volume", "value"] as const).map((key) => {
              const labels = { turnaround: "Turnaround time", volume: "Volume", value: "Expected savings or revenue" };
              const configured = priorityPolicyQuery.data?.kpis.find((item) => item.key === key);
              return <label className="block" key={key}><span className="field-label">{configured?.question ?? labels[key]}</span><input className="input" type="number" min="0" max="3" step="0.1" value={impact[key]} onChange={(event) => setImpact((current) => ({ ...current, [key]: event.target.value }))} placeholder="0" /><span className="mt-1 block text-xs text-muted">{configured?.hint ?? "0–3 score · explain the expected change"}{configured ? ` · ${Math.round(configured.weight * 100)}% weight` : ""}</span></label>;
            })}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {(["turnaround", "volume", "value"] as const).map((key) => <label className="block" key={key}><span className="field-label">{key[0].toUpperCase() + key.slice(1)} explanation</span><textarea className="input min-h-[76px]" value={metricExplanations[key]} onChange={(event) => setMetricExplanations((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
          </div>
          {priorityPolicyQuery.isPending && <p className="mt-4 text-sm text-muted" role="status">Loading priority policy…</p>}
          {priorityPolicyQuery.isError && <p className="mt-4 text-sm text-[#d6336c]" role="alert">Priority policy could not be loaded. <button className="underline" onClick={() => void priorityPolicyQuery.refetch()}>Retry</button></p>}
          {priorityResult && <div className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--line)" }} aria-live="polite"><p className="font-medium">Live priority score: {priorityResult.score.toFixed(2)} / 3 · {priorityResult.band}</p><p className="mt-1 text-muted">Minimum to submit: {priorityPolicyQuery.data!.minimumScore.toFixed(2)}</p><div className="mt-2 space-y-1">{priorityResult.breakdown.map((item) => <p key={item.key} className="flex justify-between gap-3"><span className="capitalize">{item.key} · {Math.round(item.weight * 100)}%</span><span>{item.score.toFixed(1)} → {item.contribution.toFixed(2)}</span></p>)}</div>{priorityResult.score < priorityPolicyQuery.data!.minimumScore && <p className="mt-2 text-[#d6336c]" role="alert">Increase the impact scores or improve the estimates to meet the submission minimum.</p>}</div>}
          {submissionError && <div className="mt-4 rounded-xl border border-[#d6336c]/40 p-4 text-sm" role="alert"><p className="font-medium text-[#d6336c]">{errorMessage(submissionError)}</p>{submissionRejection && priorityScoreRejected && <p className="mt-1">Server score / minimum: {submissionRejection.score?.toFixed(2) ?? "—"} / {submissionRejection.minimumScore?.toFixed(2) ?? "—"}{submissionRejection.priorityBand ? ` · ${submissionRejection.priorityBand}` : ""}</p>}{submissionRejection?.breakdown.map((item) => <p className="mt-1 flex justify-between gap-3" key={item.key}><span className="capitalize">{item.key} · {Math.round(item.weight * 100)}%</span><span>{item.score.toFixed(1)} → {item.contribution.toFixed(2)}</span></p>)}{priorityScoreRejected && <p className="mt-2 text-muted">Adjust the impact numbers to meet the server minimum, then submit again.</p>}</div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" type="button" onClick={() => dispatch(setIdeaWizardStep(4))}>Back to validation</button>
            <button className="btn-primary" type="button" disabled={!fieldsValid || busy || validationBlocked || !priorityResult || priorityResult.score < priorityPolicyQuery.data!.minimumScore} onClick={() => void submit(canSubmitForHumanReview && !validationPassed)}>{canSubmitForHumanReview && !validationPassed ? "Submit for human review" : "Submit idea"}</button>
          </div>
        </section>
      )}
      {step === 1 && (
        <div className="app-card">
          <section className="mb-5 rounded-xl border p-3" style={{ borderColor: "var(--line)" }} aria-label="Saved drafts">
            <h2 className="font-medium">Your saved drafts</h2>
            {savedDraftsQuery.isPending && <p className="mt-1 text-sm text-muted" role="status">Loading private drafts…</p>}
            {savedDraftsQuery.isError && <p className="mt-1 text-sm text-[#d6336c]" role="alert">Could not load drafts: {errorMessage(savedDraftsQuery.error)} <button className="underline" type="button" onClick={() => void savedDraftsQuery.refetch()}>Retry</button></p>}
            {savedDrafts.length === 0 && !savedDraftsQuery.isPending && !savedDraftsQuery.isError && <p className="mt-1 text-sm text-muted">No saved drafts to resume.</p>}
            {savedDrafts.length > 0 && <ul className="mt-2 space-y-2">{savedDrafts.map((draft) => <li key={draft.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--hover)] p-2"><span className="min-w-0 flex-1"><b className="block truncate text-sm">{draft.title}</b><span className="block truncate text-xs text-muted">{draft.summary}</span></span><button className="btn btn-small" type="button" disabled={Boolean(resumeDraftId)} onClick={() => setResumeDraftId(draft.id)}>{resumeDraftId === draft.id && resumeDraftQuery.isPending ? "Loading…" : "Resume draft"}</button></li>)}</ul>}
            {resumeDraftQuery.isError && <p className="mt-2 text-sm text-[#d6336c]" role="alert">Could not open this draft: {errorMessage(resumeDraftQuery.error)} <button className="underline" type="button" onClick={() => void resumeDraftQuery.refetch()}>Retry</button></p>}
          </section>
          <div
            className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border bg-white p-1"
            style={{ borderColor: "var(--line)" }}
          >
            {[
              ["idea", "💡 An idea"],
              ["problem", "🔎 A problem"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setKind(value as IdeaKind)}
                className={`rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium ${kind === value ? "bg-blue text-white" : "text-muted hover:bg-[var(--hover)]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mt-5 block">
            <span className="field-label">
              {kind === "idea"
                ? "Your idea in your own words"
                : "What is slowing customers or colleagues down?"}
            </span>
            <textarea
              className="input min-h-[124px] resize-y"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder="Describe it in your own words…"
            />
          </label>
          <div
            className="mt-4 flex gap-2 rounded-xl border border-dashed px-3.5 py-3 text-[13px] text-muted"
            style={{ borderColor: "var(--line-strong)" }}
          >
            <Icon name="bot" className="mt-0.5 h-5 w-5 shrink-0 text-blue" />
            <span>
              <b className="font-medium text-sand">Server originality check.</b>{" "}
              Related ideas are searched as you describe your proposal. The
              final match check runs when you submit the completed details.
            </span>
          </div>
          {(!searchMatches || candidateQuery.isPending) && raw.trim().length >= 4 && (
            <p className="mt-3 text-sm text-muted" aria-live="polite">
              Searching registered ideas…
            </p>
          )}
          {searchMatches && candidateQuery.isError && (
            <p className="mt-3 text-sm text-[#d6336c]" role="alert">
              Could not load related ideas: {errorMessage(candidateQuery.error)}{" "}
              <button className="underline" type="button" onClick={() => void candidateQuery.refetch()}>Retry</button>
            </p>
          )}
          {searchMatches && raw.trim().length >= 4 && (candidateQuery.data?.items.length ?? 0) > 0 && (
            <div
              className="mt-4 rounded-xl border p-3"
              style={{ borderColor: "var(--line-strong)" }}
            >
              <p className="font-medium">Potentially related ideas</p>
              <p className="mt-1 text-sm text-muted">
                Choose an original to build on, or explain at least 20
                characters of what makes your proposal different.
              </p>
              <div className="mt-2 space-y-2">
                {candidateQuery.data?.items.map((candidate) => (
                  <label
                    key={candidate.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm"
                    style={{
                      borderColor:
                        buildsOnId === candidate.id
                          ? "var(--blue)"
                          : "var(--line)",
                    }}
                  >
                    <input
                      type="radio"
                      name="buildsOn"
                      checked={buildsOnId === candidate.id}
                      onChange={() => setBuildsOnId(candidate.id)}
                    />
                    <span>
                      <b>{candidate.title}</b>
                      <span className="block text-muted">
                        {candidate.reference} · {candidate.summary}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <label className="mt-3 block">
                <span className="field-label">How is your idea different?</span>
                <textarea
                  className="input min-h-[76px]"
                  maxLength={2000}
                  value={differentiation}
                  onChange={(event) => setDifferentiation(event.target.value)}
                  placeholder="Describe the new contribution (at least 20 characters if not selecting an original)."
                />
              </label>
              <span className="text-xs text-muted">
                {differentiation.trim().length}/20 characters
              </span>
              {unresolvedOriginality && <p className="mt-2 text-sm text-[#d6336c]" role="alert">Select an original idea or enter at least 20 characters describing your new contribution.</p>}
            </div>
          )}
          {searchMatches && raw.trim().length >= 4 && candidateQuery.data?.items.length === 0 && (
            <label className="mt-4 block">
              <span className="field-label">
                Differentiation from existing work (optional)
              </span>
              <textarea
                className="input min-h-[76px]"
                maxLength={2000}
                value={differentiation}
                onChange={(event) => setDifferentiation(event.target.value)}
                placeholder="If the server finds a similar idea, explain your new contribution here."
              />
            </label>
          )}
          <button
            className="btn-primary mt-4"
            disabled={raw.trim().length < 10 || !searchMatches || candidateQuery.isPending || unresolvedOriginality}
            onClick={nextFromDescribe}
          >
            <Icon name="spark" /> Develop with AI<span className="sr-only"> — Continue to develop</span>
          </button>
        </div>
      )}
    </div>
  );
}

const lifecycle = [
  "Submitted",
  "Business review",
  "Control review",
  "Confirmation",
  "Proof of concept",
  "Implementation",
  "Impact",
];

export function EmployeeIdeaDetailPage({
  ideaId,
  onBack,
}: {
  ideaId: number;
  onBack: () => void;
}) {
  const detailQuery = useIdea(ideaId);
  const commentsQuery = useIdeaComments(ideaId, {}, Boolean(detailQuery.data?.idea && detailQuery.data.idea.status !== "draft"));
  const supportMutation = useSupportIdea();
  const commentMutation = useAddIdeaComment();
  const updateMutation = useUpdateIdea();
  const submitMutation = useSubmitIdea();
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    title: "",
    summary: "",
    problem: "",
    solution: "",
    benefits: "",
    risks: "",
  });
  const idea = detailQuery.data?.idea;
  const author = idea ? ideaAuthor(idea) : { name: "Contributor", department: undefined };
  const activeStage = idea ? ({ draft: -1, screening: 0, returned: 0, business_review: 1, control_review: 2, decision: 3, poc: 4, implementation: 5, implemented: 6, rejected: -1, deferred: -1 }[idea.status]) : -1;
  const comments =
    commentsQuery.data?.items ?? detailQuery.data?.comments.items ?? [];
  const startEdit = () => {
    if (!idea) return;
    setEdit({
      title: idea.title,
      summary: idea.summary,
      problem: idea.problem ?? "",
      solution: idea.solution ?? "",
      benefits: idea.benefits ?? "",
      risks: idea.risks ?? "",
    });
    setEditing(true);
  };
  const saveAndResubmit = async () => {
    if (!idea) return;
    try {
      const result = await updateMutation.mutateAsync({
        id: idea.id,
        input: edit,
      });
      const versionId = Number(
        (result.version as { id?: number } | undefined)?.id,
      );
      await submitMutation.mutateAsync({
        id: idea.id,
        versionId: Number.isInteger(versionId) ? versionId : undefined,
      });
      setEditing(false);
    } catch {
      /* mutation errors are shown in the editor */
    }
  };
  if (detailQuery.isPending)
    return (
      <StateMessage
        title="Loading idea…"
        detail="Getting the proposal and its discussion."
      />
    );
  if (detailQuery.isError || !idea)
    return (
      <StateMessage
        title="Idea unavailable"
        detail={
          detailQuery.isError
            ? errorMessage(detailQuery.error)
            : "This idea may have been removed."
        }
        action={
          <button className="btn" onClick={onBack}>
            Back to community
          </button>
        }
      />
    );
  return (
    <div className="stack">
      <button className="btn btn-small self-start" onClick={onBack}>
        <Icon name="back" className="h-4 w-4" /> Back to Community
      </button>
      <section className="app-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusPill tone="blue">{idea.category}</StatusPill>
          <StatusPill tone={idea.status === "returned" ? "sand" : "blue"}>
            {statusLabels[idea.status]}
          </StatusPill>
        </div>
        <h1 className="mt-4 text-[28px] font-medium leading-tight">
          {idea.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Avatar name={author.name} />
          <span className="text-sm">
            <b className="font-medium">{author.name}</b>{" "}
            <span className="text-muted">{author.department}</span>
          </span>
          <span className="ml-auto font-mono text-xs text-muted">
            {idea.reference}
          </span>
        </div>
        {idea.status !== "draft" && <div className="my-7 overflow-x-auto pb-2" aria-label="Idea progress">
          <ol className="grid min-w-[620px] grid-cols-7 gap-0">
            {lifecycle.map((stage, index) => (
              <li key={stage} aria-current={index === activeStage ? "step" : undefined} className={`relative text-center text-xs ${index === activeStage ? "text-sand" : index < activeStage ? "text-blue" : "text-muted"}`}>
                {index < lifecycle.length - 1 && <span className="absolute left-1/2 right-[-50%] top-5 border-t border-[var(--line-strong)]" aria-hidden="true" />}
                <span className={`relative mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full border bg-white ${index === activeStage ? "border-sand ring-4 ring-sand/10" : "border-[var(--line-strong)]"}`}><Icon name={index < activeStage ? "check" : (["spark", "msg", "shield", "check", "bot", "arrow", "up"] as const)[index]} /></span>
                <span>{stage}</span>
              </li>
            ))}
          </ol>
        </div>}
        {editing ? (
          <div className="space-y-4">
            <label className="block">
              <span className="field-label">Idea title</span>
              <input
                className="input"
                value={edit.title}
                onChange={(event) =>
                  setEdit((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="field-label">Summary</span>
              <textarea
                className="input min-h-[90px]"
                value={edit.summary}
                onChange={(event) =>
                  setEdit((current) => ({
                    ...current,
                    summary: event.target.value,
                  }))
                }
              />
            </label>
            {developFields.map((field) => (
              <label key={field.key} className="block">
                <span className="field-label">{field.label}</span>
                <textarea
                  className="input min-h-[90px]"
                  value={edit[field.key]}
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
            {(updateMutation.isError || submitMutation.isError) && (
              <p
                className="rounded-xl border border-pink/30 bg-pink/10 p-3 text-sm text-[#d6336c]"
                role="alert"
              >
                {errorMessage(updateMutation.error ?? submitMutation.error)}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={updateMutation.isPending || submitMutation.isPending}
                onClick={() => void saveAndResubmit()}
              >
                {updateMutation.isPending || submitMutation.isPending
                  ? "Resubmitting…"
                  : "Save and resubmit"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="flex gap-2 rounded-xl border p-3 text-sm"
              style={{ borderColor: "var(--line-strong)" }}
            >
              <Icon name="lock" className="mt-0.5 h-5 w-5 shrink-0 text-blue" />
              <div>
                <b className="font-medium">Registered to {author.name}{author.department ? `, ${author.department}` : ""}</b>
                <p className="text-muted">
                  {idea.status === "draft" ? `Draft ${idea.reference} is visible only to you.` : `Record ${idea.reference}. Supporters and commenters are credited by name.`}
                </p>
              </div>
            </div>
            <p className="mt-5 text-base">{idea.summary}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                ["Problem", idea.problem],
                ["Solution", idea.solution],
                ["Expected benefits", idea.benefits],
                ["Risks", idea.risks],
              ].map(([label, value]) => (
                <div className="tile" key={label}>
                  <small className="block text-xs text-muted">{label}</small>
                  <span>{value || "Not provided yet."}</span>
                </div>
              ))}
            </div>
            {idea.status === "draft" && <p className="mt-4 text-sm text-muted">This draft is private until AI validation and final submission finish.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {idea.status !== "draft" &&
              <button
                className="btn-primary"
                disabled={supportMutation.isPending}
                onClick={() => supportMutation.mutate(idea.id)}
              >
                <Icon name="up" />{" "}
                {supportMutation.isPending
                  ? "Supporting…"
                  : `${idea.supports} Support this idea`}
              </button>}
              {idea.status === "returned" && (
                <button className="btn" onClick={startEdit}>
                  Edit and resubmit
                </button>
              )}
            </div>
            {supportMutation.isError && (
              <p className="mt-3 text-sm text-[#d6336c]" role="alert">
                {errorMessage(supportMutation.error)}
              </p>
            )}
          </>
        )}
      </section>
      {idea.status !== "draft" && <section className="app-card">
        <h2 className="text-xl font-medium">
          Discussion{" "}
          <span className="font-normal text-muted">
            ({commentsQuery.isPending ? "…" : comments.length})
          </span>
        </h2>
        {commentsQuery.isError ? (
          <p className="mt-2 text-sm text-[#d6336c]" role="alert">
            {errorMessage(commentsQuery.error)}
          </p>
        ) : comments.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No comments yet. Be the first.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {comments.map((item) => (
              <div
                className="rounded-xl border p-3"
                key={item.id}
                style={{ borderColor: "var(--line)" }}
              >
                <div className="flex items-center gap-2 text-sm">
                  <Avatar name={item.author?.name ?? "Member"} />
                  <b className="font-medium">
                    {item.author?.name ?? "Community member"}
                  </b>
                  <span className="text-xs text-muted">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-end gap-2">
          <textarea
            className="input min-h-[76px]"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            aria-label="Add a comment or a suggestion"
            placeholder="Add a comment or a suggestion"
          />
          <button
            className="btn-primary"
            disabled={!comment.trim() || commentMutation.isPending}
            onClick={() => {
              void commentMutation
                .mutateAsync({ id: idea.id, body: comment.trim() })
                .then(() => setComment(""))
                .catch(() => undefined);
            }}
          >
            {commentMutation.isPending ? "Posting…" : "Post"}
          </button>
        </div>
        {commentMutation.isError && (
          <p className="mt-2 text-sm text-[#d6336c]" role="alert">
            {errorMessage(commentMutation.error)}
          </p>
        )}
      </section>}
    </div>
  );
}
