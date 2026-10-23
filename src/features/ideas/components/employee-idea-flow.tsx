"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { ApiError } from "../../../lib/api/client";
import type { AppDispatch, RootState } from "../../../store";
import { resetIdeaWizard, setIdeaWizardStep } from "../../../store/ui-slice";
import { useAddIdeaComment, useCreateIdea, useIdea, useIdeaAiStatus, useIdeaComments, useIdeas, useSaveIdeaSubmission, useSubmitIdea, useSupportIdea, useUpdateIdea } from "../hooks";
import { EmployeeFeedbackCampaignForm, EmployeeNotificationsPanel } from "../../employee/employee-engagement";
import type { Idea, IdeaCreateInput, IdeaKind, IdeaSubmissionInput } from "../types";

type Page = "community" | "new" | "learn" | "library" | "rewards" | "me" | "article" | "idea" | "quiz";

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

function Icon({ name, className = "h-[19px] w-[19px]" }: { name: IconName; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d={iconPaths[name]} /></svg>;
}

function Avatar({ name, size = "sm" }: { name: string | number; size?: "sm" | "md" | "lg" }) {
  const label = String(name).trim();
  const colors = ["#2F80ED", "#12A383", "#7C5CE0", "#E8891C", "#DB4C7F", "#0E9AD6"];
  const color = colors[label.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
  const classes = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-12 w-12 text-lg" };
  return <span className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${classes[size]}`} style={{ background: color }}>{label[0]?.toUpperCase() ?? "?"}</span>;
}

function StatusPill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "teal" | "sand" | "muted" }) {
  const tones = { blue: "text-blue border-blue/45", teal: "text-[#0e9f7a] border-[#0e9f7a]/50", sand: "text-sand border-sand/50", muted: "text-muted border-[var(--line-strong)]" };
  return <span className={`pill ${tones[tone]}`}><span className="pill-dot" />{children}</span>;
}

function StateMessage({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="app-card py-12 text-center"><h2 className="text-xl font-medium">{title}</h2>{detail && <p className="mx-auto mt-2 max-w-[52ch] text-sm text-muted">{detail}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function IdeaCard({ idea, onOpen }: { idea: Idea; onOpen: () => void }) {
  const tone = idea.priorityBand === "Priority" ? "#7c5ce0" : idea.priorityBand === "Qualify" ? "#12a383" : "#2f80ed";
  const bandTone = idea.priorityBand === "Priority" ? "sand" : idea.priorityBand === "Qualify" ? "teal" : "muted";
  return <article className="app-card border-t-[3px] p-5" style={{ borderTopColor: tone }}>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="pill text-blue border-blue/45">{idea.category}</span><StatusPill tone={bandTone}>{idea.priorityBand ?? idea.status}</StatusPill></div>
    <button onClick={onOpen} className="mt-3 text-left text-base font-medium leading-snug hover:text-blue">{idea.kind === "problem" ? "🔎 " : ""}{idea.title}</button>
    <p className="mt-2 text-sm text-muted">{idea.summary}</p>
    <div className="mt-3 flex items-center gap-2"><Avatar name="padmadev" /><span className="flex-1 text-sm"><b className="font-medium">Community member</b> <span className="text-muted">Idea contributor</span></span><span className="font-mono text-xs tracking-[.08em] text-muted">{idea.reference}</span></div>
    <div className="mt-3 flex flex-wrap gap-2"><button className="btn btn-small" onClick={onOpen}><Icon name="up" className="h-4 w-4" /> {idea.supports} Support</button><button onClick={onOpen} className="btn btn-small"><Icon name="msg" className="h-4 w-4" /> {idea.comments} Discuss</button></div>
  </article>;
}

export function EmployeeCommunityPage({ onNavigate, onOpenIdea }: { onNavigate: (page: Page) => void; onOpenIdea: (id: number) => void }) {
  const [filter, setFilter] = useState("Everything");
  const [query, setQuery] = useState("");
  const params = useMemo(() => ({ page: 1, pageSize: 20, search: query || undefined, mine: filter === "Mine" }), [filter, query]);
  const ideasQuery = useIdeas(params);
  const items = useMemo(() => (ideasQuery.data?.items ?? []).filter((idea) => filter === "Everything" || filter === "Mine" || (filter === "Ideas" ? idea.kind === "idea" : idea.kind === "problem")), [filter, ideasQuery.data?.items]);
  return <div className="stack">
    <div className="flex flex-col justify-between gap-5 xl:flex-row"><div><h1 className="text-[26px] font-medium tracking-[-.02em] sm:text-[32px]">Good afternoon, padmadev <span>👋</span></h1><p className="mt-1.5 text-base text-muted">Your next idea could improve how we serve customers and each other.</p><button className="btn-primary mt-4" onClick={() => onNavigate("new")}><Icon name="spark" /> Share an idea</button></div><div className="hero-surface rounded-[18px] p-5 text-white shadow-[0_18px_36px_-18px_var(--blue-deep)] sm:w-[340px]"><div className="text-xs font-medium tracking-[.14em]">AB IGNITE · LEVEL 1</div><div className="mt-8 text-[32px] font-semibold leading-none">💡 0</div><div className="mt-1 text-xs text-white/80">Ignite account balance, in points</div></div></div>
    <div className="grid gap-4 xl:grid-cols-2"><EmployeeFeedbackCampaignForm /><EmployeeNotificationsPanel /></div>
    <div className="flex flex-wrap items-center gap-3"><div className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border bg-white p-1" style={{ borderColor: "var(--line)" }}>{["Everything", "Ideas", "Problems", "Mine"].map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium ${filter === item ? "bg-blue text-white" : "text-muted hover:bg-[var(--hover)]"}`}>{item}</button>)}</div><label className="flex min-w-[220px] flex-1 items-center gap-2"><span className="sr-only">Search ideas</span><span className="relative flex-1"><Icon name="search" className="absolute left-3 top-3 h-4 w-4 text-muted" /><input className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ideas, people or references" /></span></label></div>
    <p className="-mt-3 flex items-center gap-2 text-sm text-muted"><Icon name="lock" className="h-4 w-4" />Every idea is registered to its author. You support colleagues’ ideas, not your own.</p>
    {ideasQuery.isPending ? <StateMessage title="Loading ideas…" detail="Getting the latest community proposals." /> : ideasQuery.isError ? <StateMessage title="Ideas are temporarily unavailable" detail={errorMessage(ideasQuery.error)} action={<button className="btn" onClick={() => void ideasQuery.refetch()}>Try again</button>} /> : items.length === 0 ? <StateMessage title="No ideas found" detail={query ? "Try a different search or clear the filter." : "Be the first to share an idea with the community."} action={<button className="btn-primary" onClick={() => onNavigate("new")}>Share an idea</button>} /> : <div className="grid gap-[18px] xl:grid-cols-2">{items.map((idea) => <IdeaCard key={idea.id} idea={idea} onOpen={() => onOpenIdea(idea.id)} />)}</div>}
  </div>;
}

const questionPrompts = ["Who experiences this problem today?", "What evidence tells you it is worth solving?", "Which teams or customers will benefit most?", "What could make the proposal difficult?", "How would you know the change worked?"];
const developFields = [{ key: "problem", label: "Problem statement", placeholder: "What problem are you solving?" }, { key: "solution", label: "Proposed solution", placeholder: "What would you change?" }, { key: "benefits", label: "Expected benefits", placeholder: "Who benefits and how?" }, { key: "risks", label: "Possible risks", placeholder: "What should reviewers think about?" }] as const;

function IdeaStepBar({ step }: { step: number }) {
  return <div className="grid grid-cols-5 gap-1.5 overflow-hidden sm:gap-2">{["Describe", "Develop", "Questions", "Pass or fail", "Numbers"].map((label, index) => <div key={label} className={`flex items-center gap-2 rounded-[11px] border px-2.5 py-2.5 text-[13px] font-medium ${step === index + 1 ? "border-blue bg-blue/[.12] text-ink" : step > index + 1 ? "text-muted" : "text-[var(--dim)]"}`} style={{ borderColor: step === index + 1 ? "var(--blue)" : "var(--line)" }}><b className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-xs ${step > index + 1 ? "border-[#0e9f7a] text-[#0e9f7a]" : step === index + 1 ? "border-blue bg-blue text-white" : ""}`} style={{ borderColor: step > index + 1 || step === index + 1 ? undefined : "var(--line-strong)" }}>{step > index + 1 ? "✓" : index + 1}</b><span className="hidden sm:inline">{label}</span></div>)}</div>;
}

export function EmployeeIdeaSubmissionPage({ onOpenIdea }: { onOpenIdea: (id: number) => void }) {
  const dispatch = useDispatch<AppDispatch>();
  const step = useSelector((state: RootState) => state.ui.ideaWizardStep);
  const [kind, setKind] = useState<IdeaKind>("idea");
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({ problem: "", solution: "", benefits: "", risks: "" });
  const [answers, setAnswers] = useState<string[]>(() => questionPrompts.map(() => ""));
  const [impact, setImpact] = useState({ turnaround: "", volume: "", value: "" });
  const [buildsOnId, setBuildsOnId] = useState<number | undefined>();
  const [differentiation, setDifferentiation] = useState("");
  const [metricExplanations, setMetricExplanations] = useState({ turnaround: "", volume: "", value: "" });
  const [created, setCreated] = useState<{ idea: Idea; versionId: number } | null>(null);
  const [submitResult, setSubmitResult] = useState<import("../types").IdeaSubmitResponse | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const createMutation = useCreateIdea();
  const saveSubmissionMutation = useSaveIdeaSubmission();
  const submitMutation = useSubmitIdea();
  const busy = createMutation.isPending || saveSubmissionMutation.isPending || submitMutation.isPending;
  const candidateQuery = useIdeas({ page: 1, pageSize: 5, search: raw.trim().length >= 4 ? raw.trim().slice(0, 120) : undefined });
  const aiStatusQuery = useIdeaAiStatus(created?.idea.id ?? 0, Boolean(created && submitResult && !submitResult.submitted));
  const metrics = { turnaround: Number(impact.turnaround), volume: Number(impact.volume), value: Number(impact.value) };
  const liveScore = Math.round((metrics.turnaround * 0.3 + metrics.volume * 0.3 + metrics.value * 0.4) * 100) / 100;
  const submissionInput: IdeaSubmissionInput = { answers: { beneficiaries: answers[0], currentProcess: answers[1], needed: answers[2], risks: answers[3], successMeasure: answers[4] }, metrics: { ...metrics, turnaroundExplanation: metricExplanations.turnaround || undefined, volumeExplanation: metricExplanations.volume || undefined, valueExplanation: metricExplanations.value || undefined }, buildsOnId, differentiation: differentiation.trim() || undefined };
  const fieldsValid = title.trim().length >= 3 && summary.trim().length >= 10 && answers.every((answer) => answer.trim().length > 0) && [metrics.turnaround, metrics.volume, metrics.value].every((value) => Number.isFinite(value) && value >= 0 && value <= 3);
  const serverValidation = saveSubmissionMutation.data;

  useEffect(() => { dispatch(resetIdeaWizard()); }, [dispatch]);

  const nextFromDescribe = () => { if (raw.trim().length >= 10) dispatch(setIdeaWizardStep(2)); };
  const finishSubmit = async (id: number, versionId: number) => {
    try {
      const result = await submitMutation.mutateAsync({ id, versionId });
      setSubmitResult(result);
    } catch (error) {
      setSubmitError(error);
    }
  };
  useEffect(() => {
    if (!created || !submitResult || submitResult.submitted || submitError || submitMutation.isPending) return;
    const preflight = aiStatusQuery.data?.runs.find((run) => run.jobKey === "idea.preflight");
    if (preflight?.status === "succeeded") void finishSubmit(created.idea.id, created.versionId).catch(() => undefined);
  }, [aiStatusQuery.data, created, submitResult, submitError, submitMutation.isPending]);
  const submit = async () => {
    if (!fieldsValid || busy || (candidateQuery.data?.items.some((item) => item.id !== buildsOnId) && !buildsOnId && differentiation.trim().length < 20)) return;
    try {
      const input: IdeaCreateInput = { kind, title: title.trim(), summary: summary.trim(), category: "Customer", problem: details.problem.trim() || undefined, solution: details.solution.trim() || undefined, benefits: details.benefits.trim() || undefined, risks: details.risks.trim() || undefined, dataClassification: "internal", buildsOnId, differentiation: differentiation.trim() || undefined };
      const result = await createMutation.mutateAsync(input);
      await saveSubmissionMutation.mutateAsync({ id: result.idea.id, input: submissionInput });
      setCreated(result);
      await finishSubmit(result.idea.id, result.versionId);
    } catch { /* the mutation error is rendered below */ }
  };
  if (created) {
    const preflight = aiStatusQuery.data?.runs.find((run) => run.jobKey === "idea.preflight");
    const completed = Boolean(submitResult?.submitted);
    const failed = Boolean(submitError || (preflight && ["failed", "timed_out", "cancelled"].includes(preflight.status)));
    return <div className="stack"><section className="app-card py-14 text-center"><div className="icon-box mx-auto mb-3" style={{ color: completed ? "var(--teal)" : failed ? "#d6336c" : "var(--blue)", background: completed ? "rgba(14,159,122,.12)" : "rgba(47,128,237,.12)" }}><Icon name={completed ? "check" : "bot"} /></div><h1 className="text-2xl font-medium">{completed ? "Idea submitted" : failed ? "Validation needs attention" : "Idea received — validation queued"}</h1><p className="mx-auto mt-2 max-w-[52ch] text-muted">{completed ? <>Your idea is registered as <b>{submitResult?.reference ?? created.idea.reference}</b>. An innovation reviewer screens it first, and you are notified at every step.</> : failed ? "The server could not complete validation or submission. Your idea is saved; review the message and try again if appropriate." : `Reference ${created.idea.reference}. The server is checking your idea before it is submitted.`}</p>{!completed && !failed && <p className="mt-3 text-sm text-muted" aria-live="polite">{submitMutation.isPending || preflight?.status === "queued" || preflight?.status === "running" ? "Checking originality and safety…" : "Waiting for the preflight result…"}</p>}{(aiStatusQuery.isError || Boolean(submitError)) && <p className="mx-auto mt-3 max-w-[52ch] text-sm text-[#d6336c]" role="alert">{errorMessage(aiStatusQuery.error ?? submitError)}</p>}<div className="mt-5 flex flex-wrap justify-center gap-2">{completed && <button className="btn" onClick={() => onOpenIdea(created.idea.id)}>View idea</button>}{(failed || completed) && <button className="btn-primary" onClick={() => { setCreated(null); setSubmitResult(null); setSubmitError(null); setRaw(""); setTitle(""); setSummary(""); setDetails({ problem: "", solution: "", benefits: "", risks: "" }); setAnswers(questionPrompts.map(() => "")); setImpact({ turnaround: "", volume: "", value: "" }); dispatch(resetIdeaWizard()); }}>Share another idea</button>}</div></section></div>;
  }
  return <div className="stack"><section className="hero-surface relative overflow-hidden rounded-[24px] px-5 py-6 text-white sm:px-7 sm:py-[30px]"><div className="relative z-10 max-w-[62%]"><h1 className="text-[25px] font-medium leading-tight tracking-[-.02em] sm:text-[32px]">Share an idea</h1><p className="mt-1.5 text-sm leading-6 text-white/85 sm:text-[15px]">Turn a customer or colleague insight into a clear proposal the bank can act on.</p></div></section><IdeaStepBar step={step} />
    {step === 1 && <div className="app-card"><div className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border bg-white p-1" style={{ borderColor: "var(--line)" }}>{[["idea", "💡 An idea"], ["problem", "🔎 A problem"]].map(([value, label]) => <button key={value} onClick={() => setKind(value as IdeaKind)} className={`rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium ${kind === value ? "bg-blue text-white" : "text-muted hover:bg-[var(--hover)]"}`}>{label}</button>)}</div><label className="mt-5 block"><span className="field-label">{kind === "idea" ? "Your idea in your own words" : "What is slowing customers or colleagues down?"}</span><textarea className="input min-h-[124px] resize-y" value={raw} onChange={(event) => setRaw(event.target.value)} placeholder="Describe it in your own words…" /></label><div className="mt-4 flex gap-2 rounded-xl border border-dashed px-3.5 py-3 text-[13px] text-muted" style={{ borderColor: "var(--line-strong)" }}><Icon name="bot" className="mt-0.5 h-5 w-5 shrink-0 text-blue" /><span><b className="font-medium text-sand">Server originality check.</b> Related ideas are searched as you describe your proposal. The final match check runs when you submit the completed details.</span></div>{candidateQuery.isPending && raw.trim().length >= 4 && <p className="mt-3 text-sm text-muted" aria-live="polite">Searching registered ideas…</p>}{candidateQuery.isError && <p className="mt-3 text-sm text-[#d6336c]" role="alert">Could not load related ideas: {errorMessage(candidateQuery.error)}</p>}{(candidateQuery.data?.items.length ?? 0) > 0 && <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--line-strong)" }}><p className="font-medium">Potentially related ideas</p><p className="mt-1 text-sm text-muted">Choose an original to build on, or explain at least 20 characters of what makes your proposal different.</p><div className="mt-2 space-y-2">{candidateQuery.data?.items.map((candidate) => <label key={candidate.id} className="flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm" style={{ borderColor: buildsOnId === candidate.id ? "var(--blue)" : "var(--line)" }}><input type="radio" name="buildsOn" checked={buildsOnId === candidate.id} onChange={() => setBuildsOnId(candidate.id)} /><span><b>{candidate.title}</b><span className="block text-muted">{candidate.reference} · {candidate.summary}</span></span></label>)}</div><label className="mt-3 block"><span className="field-label">How is your idea different?</span><textarea className="input min-h-[76px]" maxLength={2000} value={differentiation} onChange={(event) => setDifferentiation(event.target.value)} placeholder="Describe the new contribution (at least 20 characters if not selecting an original)." /></label><span className="text-xs text-muted">{differentiation.trim().length}/20 characters</span></div>}{candidateQuery.data?.items.length === 0 && <label className="mt-4 block"><span className="field-label">Differentiation from existing work (optional)</span><textarea className="input min-h-[76px]" maxLength={2000} value={differentiation} onChange={(event) => setDifferentiation(event.target.value)} placeholder="If the server finds a similar idea, explain your new contribution here." /></label>}<button className="btn-primary mt-4" disabled={raw.trim().length < 10 || candidateQuery.isPending} onClick={nextFromDescribe}><Icon name="spark" /> Continue to develop</button></div>}
    {step === 2 && <><div className="app-card"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-medium">Develop your idea</h2><p className="mt-1 text-muted">Fill in the sections. The more specific you are, the better the validation.</p></div><StatusPill tone="blue">Customer</StatusPill></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="field-label">Idea title</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Give your idea a clear title" /></label><label className="block sm:col-span-2"><span className="field-label">In one or two sentences</span><textarea className="input min-h-[90px]" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Summarise the change and its value" /></label>{developFields.map((field) => <label key={field.key} className="block"><span className="field-label">{field.label}</span><textarea className="input min-h-[124px]" value={details[field.key]} onChange={(event) => setDetails((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} /></label>)}</div></div><div className="flex flex-wrap gap-2"><button className="btn" onClick={() => dispatch(setIdeaWizardStep(1))}>Back</button><button className="btn-primary" disabled={!title.trim() || !summary.trim()} onClick={() => dispatch(setIdeaWizardStep(3))}><Icon name="bot" /> Answer five questions</button></div></>}
    {step === 3 && <div className="app-card"><div className="flex items-start gap-3"><div className="icon-box"><Icon name="bot" /></div><div><h2 className="text-xl font-medium">Questions reviewers may ask</h2><p className="mt-1 text-muted">Use these five prompts to find the weak spots before you submit.</p></div></div><div className="mt-4 space-y-3">{questionPrompts.map((prompt, index) => <label key={prompt} className="block rounded-xl border-l-2 px-3 py-1" style={{ borderColor: "var(--line-strong)" }}><span className="font-medium">{prompt}</span><textarea className="input mt-2 min-h-[76px]" value={answers[index]} onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} placeholder="Your answer" /></label>)}</div><div className="mt-4 flex gap-2"><button className="btn" onClick={() => dispatch(setIdeaWizardStep(2))}>Back</button><button className="btn-primary" onClick={() => dispatch(setIdeaWizardStep(4))}>Validate my idea</button></div></div>}
    {step === 4 && <div className="app-card"><div className="flex items-start gap-3"><div className="icon-box" style={{ color: "var(--sand)", background: "rgba(217,119,6,.12)" }}><Icon name="shield" /></div><div><h2 className="text-xl font-medium">{fieldsValid ? "Content complete" : "A little more detail is needed"}</h2><p className="mt-1 text-muted">{fieldsValid ? "Required details are present. The server checks AI safety and originality during submission." : "Complete the title, summary, and all reviewer prompts before continuing."}</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[["Title and summary", title.trim().length >= 3 && summary.trim().length >= 10 ? "Ready" : "Needs detail"], ["Reviewer questions", answers.every((answer) => answer.trim()) ? "5 of 5 answered" : `${answers.filter((answer) => answer.trim()).length} of 5 answered`], ["Server validation", serverValidation ? serverValidation.score >= serverValidation.minimumScore ? "Score passes" : "Below minimum" : "Runs at submit"]].map(([label, value]) => <div key={label} className="tile text-center"><span className="block text-sm text-muted">{label}</span><b className="my-1 block text-lg font-semibold">{value}</b></div>)}</div><div className="mt-5 flex flex-wrap gap-2"><button className="btn" onClick={() => dispatch(setIdeaWizardStep(3))}>Back</button><button className="btn-primary" disabled={!fieldsValid} onClick={() => dispatch(setIdeaWizardStep(5))}>Continue to numbers</button></div></div>}
    {step === 5 && <div className="app-card"><h2 className="text-xl font-medium">Add impact numbers</h2><p className="mt-1 text-muted">Use a 0–3 estimate for each measure. The server applies the 30/30/40 weighting and minimum score.</p><div className="mt-4 grid gap-4 sm:grid-cols-3">{[["turnaround", "Turnaround time", "% faster"], ["volume", "Volume", "per month"], ["value", "Expected savings or revenue", "JOD per year"]].map(([key, label, unit]) => <label key={key} className="block"><span className="field-label">{label}</span><input className="input" value={impact[key as keyof typeof impact]} onChange={(event) => setImpact((current) => ({ ...current, [key]: event.target.value }))} placeholder="0–3" inputMode="decimal" min="0" max="3" step="0.1" type="number" /><span className="mt-1 block text-xs text-muted">{unit}</span><textarea className="input mt-2 min-h-[64px]" aria-label={`${label} explanation (optional)`} value={metricExplanations[key as keyof typeof metricExplanations]} onChange={(event) => setMetricExplanations((current) => ({ ...current, [key]: event.target.value }))} placeholder="Why this estimate? (optional)" /></label>)}</div><div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--line-strong)" }}><div className="flex items-center justify-between gap-3"><span className="font-medium">Live weighted score</span><b className="text-xl">{Number.isFinite(liveScore) ? liveScore.toFixed(2) : "—"} / 3</b></div><p className="mt-1 text-sm text-muted">30% turnaround + 30% volume + 40% value{serverValidation ? ` · Server score ${serverValidation.score.toFixed(2)} · minimum ${serverValidation.minimumScore.toFixed(2)}` : " · Final threshold checked by server"}</p>{serverValidation && <StatusPill tone={serverValidation.score >= serverValidation.minimumScore ? "teal" : "sand"}>{serverValidation.score >= serverValidation.minimumScore ? "Meets minimum" : "Below minimum"}</StatusPill>}</div>{(createMutation.isError || saveSubmissionMutation.isError || submitMutation.isError) && <p className="mt-4 rounded-xl border border-pink/30 bg-pink/10 p-3 text-sm text-[#d6336c]" role="alert">{errorMessage(createMutation.error ?? saveSubmissionMutation.error ?? submitMutation.error)}</p>}{!fieldsValid && <p className="mt-3 text-sm text-muted">Complete all five answers and three numeric measures before submitting.</p>}<div className="mt-5 flex flex-wrap gap-2"><button className="btn" onClick={() => dispatch(setIdeaWizardStep(4))}>Back</button><button className="btn-primary" disabled={!fieldsValid || busy || (Boolean(candidateQuery.data?.items.length) && !buildsOnId && differentiation.trim().length < 20)} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit idea"} <Icon name="arrow" className="h-4 w-4" /></button></div></div>}
  </div>;
}

const lifecycle = ["Submitted", "Business review", "Control review", "Confirmation", "Proof of concept", "Implementation", "Impact"];

export function EmployeeIdeaDetailPage({ ideaId, onBack }: { ideaId: number; onBack: () => void }) {
  const detailQuery = useIdea(ideaId);
  const commentsQuery = useIdeaComments(ideaId);
  const supportMutation = useSupportIdea();
  const commentMutation = useAddIdeaComment();
  const updateMutation = useUpdateIdea();
  const submitMutation = useSubmitIdea();
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ title: "", summary: "", problem: "", solution: "", benefits: "", risks: "" });
  const idea = detailQuery.data?.idea;
  const comments = commentsQuery.data?.items ?? detailQuery.data?.comments.items ?? [];
  const startEdit = () => { if (!idea) return; setEdit({ title: idea.title, summary: idea.summary, problem: idea.problem ?? "", solution: idea.solution ?? "", benefits: idea.benefits ?? "", risks: idea.risks ?? "" }); setEditing(true); };
  const saveAndResubmit = async () => {
    if (!idea) return;
    try {
      const result = await updateMutation.mutateAsync({ id: idea.id, input: edit });
      const versionId = Number((result.version as { id?: number } | undefined)?.id);
      await submitMutation.mutateAsync({ id: idea.id, versionId: Number.isInteger(versionId) ? versionId : undefined });
      setEditing(false);
    } catch { /* mutation errors are shown in the editor */ }
  };
  if (detailQuery.isPending) return <StateMessage title="Loading idea…" detail="Getting the proposal and its discussion." />;
  if (detailQuery.isError || !idea) return <StateMessage title="Idea unavailable" detail={detailQuery.isError ? errorMessage(detailQuery.error) : "This idea may have been removed."} action={<button className="btn" onClick={onBack}>Back to community</button>} />;
  return <div className="stack"><button className="btn btn-small self-start" onClick={onBack}><Icon name="back" className="h-4 w-4" /> Back to Community</button><section className="app-card"><div className="flex flex-wrap items-center justify-between gap-2"><StatusPill tone="blue">{idea.category}</StatusPill><StatusPill tone={idea.status === "returned" ? "sand" : "blue"}>{idea.status.replaceAll("_", " ")}</StatusPill></div><h1 className="mt-4 text-[28px] font-medium leading-tight">{idea.title}</h1><div className="mt-3 flex items-center gap-2"><Avatar name="padmadev" /><span className="text-sm"><b className="font-medium">Community member</b> <span className="text-muted">Technology</span></span><span className="ml-auto font-mono text-xs text-muted">{idea.reference}</span></div><div className="my-5 grid grid-cols-7 gap-1.5">{lifecycle.map((stage, index) => <div key={stage} className={`text-center text-[11px] ${index === 0 ? "text-sand" : "text-[var(--dim)]"}`}><span className={`mx-auto mb-1 grid h-8 w-8 place-items-center rounded-full border ${index === 0 ? "border-sand text-sand" : ""}`} style={{ borderColor: index === 0 ? "var(--sand)" : "var(--line-strong)" }}><Icon name={index === 0 ? "spark" : "check"} className="h-4 w-4" /></span><span className="hidden sm:block">{stage}</span></div>)}</div>{editing ? <div className="space-y-4"><label className="block"><span className="field-label">Idea title</span><input className="input" value={edit.title} onChange={(event) => setEdit((current) => ({ ...current, title: event.target.value }))} /></label><label className="block"><span className="field-label">Summary</span><textarea className="input min-h-[90px]" value={edit.summary} onChange={(event) => setEdit((current) => ({ ...current, summary: event.target.value }))} /></label>{developFields.map((field) => <label key={field.key} className="block"><span className="field-label">{field.label}</span><textarea className="input min-h-[90px]" value={edit[field.key]} onChange={(event) => setEdit((current) => ({ ...current, [field.key]: event.target.value }))} /></label>)}{(updateMutation.isError || submitMutation.isError) && <p className="rounded-xl border border-pink/30 bg-pink/10 p-3 text-sm text-[#d6336c]" role="alert">{errorMessage(updateMutation.error ?? submitMutation.error)}</p>}<div className="flex flex-wrap gap-2"><button className="btn" onClick={() => setEditing(false)}>Cancel</button><button className="btn-primary" disabled={updateMutation.isPending || submitMutation.isPending} onClick={() => void saveAndResubmit()}>{updateMutation.isPending || submitMutation.isPending ? "Resubmitting…" : "Save and resubmit"}</button></div></div> : <><div className="flex gap-2 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--line-strong)" }}><Icon name="lock" className="mt-0.5 h-5 w-5 shrink-0 text-blue" /><div><b className="font-medium">Registered to its author</b><p className="text-muted">Record {idea.reference}. Supporters and commenters are credited by name.</p></div></div><p className="mt-5 text-base">{idea.summary}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{[["Problem", idea.problem], ["Solution", idea.solution], ["Expected benefits", idea.benefits], ["Risks", idea.risks]].map(([label, value]) => <div className="tile" key={label}><small className="block text-xs text-muted">{label}</small><span>{value || "Not provided yet."}</span></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary" disabled={supportMutation.isPending} onClick={() => void supportMutation.mutateAsync(idea.id)}><Icon name="up" /> {supportMutation.isPending ? "Supporting…" : `${idea.supports} Support this idea`}</button>{idea.status === "returned" && <button className="btn" onClick={startEdit}>Edit and resubmit</button>}</div>{supportMutation.isError && <p className="mt-3 text-sm text-[#d6336c]" role="alert">{errorMessage(supportMutation.error)}</p>}</>}</section><section className="app-card"><h2 className="text-xl font-medium">Discussion <span className="font-normal text-muted">({commentsQuery.isPending ? "…" : comments.length})</span></h2>{commentsQuery.isError ? <p className="mt-2 text-sm text-[#d6336c]" role="alert">{errorMessage(commentsQuery.error)}</p> : comments.length === 0 ? <p className="mt-2 text-sm text-muted">No comments yet. Be the first.</p> : <div className="mt-4 space-y-3">{comments.map((item) => <div className="rounded-xl border p-3" key={item.id} style={{ borderColor: "var(--line)" }}><div className="flex items-center gap-2 text-sm"><Avatar name={item.author?.name ?? "Member"} /><b className="font-medium">{item.author?.name ?? "Community member"}</b><span className="text-xs text-muted">{new Date(item.createdAt).toLocaleDateString()}</span></div><p className="mt-2 text-sm text-muted">{item.body}</p></div>)}</div>}<div className="mt-4 flex items-end gap-2"><textarea className="input min-h-[76px]" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment or a suggestion" /><button className="btn-primary" disabled={!comment.trim() || commentMutation.isPending} onClick={() => { void commentMutation.mutateAsync({ id: idea.id, body: comment.trim() }).then(() => setComment("")).catch(() => undefined); }}>{commentMutation.isPending ? "Posting…" : "Post"}</button></div>{commentMutation.isError && <p className="mt-2 text-sm text-[#d6336c]" role="alert">{errorMessage(commentMutation.error)}</p>}</section></div>;
}
