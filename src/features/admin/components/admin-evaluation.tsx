"use client";

import React, { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../../components/ui";
import { useAdminEvaluation, useAdminEvaluationDecision } from "../hooks";
import type { AdminEvaluationDetail } from "../types";
import { adminQueryKeys, type EvaluationAction } from "../api";
import { AdminDrawer, AdminPagination } from "./admin-data-ui";
import { listAdminEvaluationPage } from "../standalone-list-api";

const answerFields = [
  ["beneficiaries", "Who benefits?"],
  ["currentProcess", "Current process"],
  ["needed", "What is needed?"],
  ["risks", "Risks"],
  ["successMeasure", "Success measure"],
] as const;

const actionLabels: Record<EvaluationAction, string> = { approve: "Approve", return: "Return", not_recommended: "Not recommended" };
const metricLabels: Record<string, string> = { turnaround: "Turnaround", volume: "Volume", value: "Value" };

function message(error: unknown) { return error instanceof Error ? error.message : "The request could not be completed."; }
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function Assessment({ result }: { result: unknown }) {
  if (result === null || result === undefined) return <p className="text-sm text-muted">No completed AI assessment is available.</p>;
  if (typeof result !== "object" || Array.isArray(result)) return <pre className="whitespace-pre-wrap break-words text-sm">{display(result)}</pre>;
  const entries = Object.entries(result as Record<string, unknown>);
  return <dl className="grid gap-3 sm:grid-cols-2">{entries.map(([key, value]) => <div key={key} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><dt className="text-xs text-muted">{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{display(value)}</dd></div>)}</dl>;
}

export function AdminIdeaFullDetail({ detail }: { detail: AdminEvaluationDetail }) {
  const { idea, submission } = detail;
  const metrics = submission?.metrics;
  return <div className="space-y-4">
    <Card><div className="flex flex-wrap items-center gap-2"><span className="pill">{idea.reference}</span><span className="pill">{idea.status.replaceAll("_", " ")}</span><span className="ml-auto text-xs text-muted">{idea.category}</span></div><h2 className="mt-3 text-2xl font-medium">{idea.title}</h2><p className="mt-2 text-sm text-muted">{idea.authorName} · {idea.department} · Submitted {new Date(submission?.submittedAt ?? idea.createdAt).toLocaleDateString()}</p><p className="mt-4 whitespace-pre-wrap">{idea.summary}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Problem", idea.problem], ["Solution", idea.solution], ["Benefits", idea.benefits], ["Risks", idea.risks]].map(([label, value]) => <div key={label} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><h3 className="text-xs text-muted">{label}</h3><p className="mt-1 whitespace-pre-wrap text-sm">{value || "Not provided"}</p></div>)}</div></Card>
    <Card><h3 className="text-lg font-medium">Five evaluation answers</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2">{answerFields.map(([key, label]) => <div key={key} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{display(submission?.answers?.[key])}</dd></div>)}</dl>{submission?.differentiation && <p className="mt-3 text-sm"><span className="text-muted">Differentiation: </span>{submission.differentiation}</p>}</Card>
    {detail.controlReview && <Card><h3 className="text-lg font-medium">Required control approvals</h3><p className="mt-1 text-sm text-muted">Each named control needs approval from a different control reviewer.</p><ul className="mt-3 space-y-2">{detail.controlReview.required.map((name) => { const approved = detail.controlReview?.approved.includes(name); return <li key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3" style={{ borderColor: "var(--line)" }}><span className="font-medium">{name}</span><span className={`pill ${approved ? "text-teal" : "text-sand"}`}>{approved ? "Approved" : "Awaiting approval"}</span></li>; })}</ul></Card>}
    <Card><h3 className="text-lg font-medium">AI validation record</h3><div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><p className="text-xs text-muted">AI score</p><p className="mt-1 text-xl font-medium">{submission?.aiValidationScore == null ? "Not recorded" : `${submission.aiValidationScore.toFixed(1)} / 10`}</p></div><div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><p className="text-xs text-muted">Distinct draft validations</p><p className="mt-1 text-xl font-medium">{submission?.aiValidationAttempts ?? "Not recorded"}</p></div><div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><p className="text-xs text-muted">Review route</p><p className="mt-1 text-sm font-medium">{submission?.submittedWithLowAiScore ? "Human review after repeated low scores" : submission?.validationPassed ? "Standard AI validation passed" : "Validation status not recorded"}</p></div></div><p className="mt-3 text-xs text-muted">AI validation is advisory to the reviewer. The priority score and component breakdown are shown separately below.</p></Card>
    <Card><h3 className="text-lg font-medium">KPI metrics and score breakdown</h3>{submission ? <><div className="mt-3 grid gap-3 sm:grid-cols-3">{["turnaround", "volume", "value"].map((key) => <div key={key} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><p className="text-xs text-muted">{metricLabels[key]}</p><p className="mt-1 text-xl font-medium">{display(metrics?.[key])} <span className="text-sm text-muted">/ 3</span></p></div>)}</div><div className="mt-4 space-y-2">{(submission.breakdown ?? []).map((item) => <div key={item.key} className="flex flex-wrap items-start gap-2 rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><b className="min-w-24 text-sm">{metricLabels[item.key] ?? item.key}</b><span className="text-sm">Score {display(item.score)} · Weight {(item.weight * 100).toFixed(0)}%</span><span className="ml-auto text-sm text-muted">Weighted {typeof item.score === "number" ? (item.score * item.weight).toFixed(2) : "—"}</span><p className="w-full text-sm text-muted">{item.explanation || "No explanation provided."}</p></div>)}</div><div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-[var(--hover)] p-3"><b className="text-xl">{submission.score.toFixed(2)}</b><span className="text-sm text-muted">Weighted priority score · minimum {submission.minimumScore.toFixed(2)}</span></div></> : <p className="mt-2 text-sm text-muted">No submitted KPI data is available.</p>}</Card>
    <Card><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-medium">AI assessment</h3>{detail.assessment && <span className="text-xs text-muted">{detail.assessment.jobKey} · {detail.assessment.completedAt ? new Date(detail.assessment.completedAt).toLocaleString() : "Completed"}</span>}</div><Assessment result={detail.assessment?.result} /></Card>
  </div>;
}

export function AdminEvaluation({ mode = "business_owner" }: { mode?: "business_owner" | "control" }) {
  const availableActions: EvaluationAction[] = mode === "control" ? ["approve", "not_recommended"] : ["approve", "return", "not_recommended"];
  const [cursors, setCursors] = useState<(number | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const queue = useQuery({ queryKey: [...adminQueryKeys.evaluations, cursors[pageIndex]], queryFn: () => listAdminEvaluationPage(cursors[pageIndex]) });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const detail = useAdminEvaluation(selectedId);
  const decision = useAdminEvaluationDecision();
  const [pending, setPending] = useState<EvaluationAction | null>(null);
  const [reason, setReason] = useState(""); const [controlName, setControlName] = useState(""); const [success, setSuccess] = useState("");
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [priority, setPriority] = useState("");
  const items = queue.data?.items ?? [];
  const filtered = items.filter(idea => (!status || idea.status === status) && (!priority || (priority === "unscored" ? !idea.priorityBand : idea.priorityBand?.toLowerCase() === priority)) && (!search || `${idea.reference} ${idea.title} ${idea.authorName} ${idea.department}`.toLowerCase().includes(search.toLowerCase())));
  const pageCount = Math.max(1, Math.ceil((queue.data?.total ?? 0) / 10));
  const statuses = Array.from(new Set(items.map(i => i.status)));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !pending || !reason.trim() || (mode === "control" && pending === "approve" && !controlName)) return;
    try { await decision.mutateAsync({ ideaId: selectedId, action: pending, reason: reason.trim(), ...(mode === "control" && pending === "approve" ? { controlName } : {}) }); setSuccess(`${mode === "control" && pending === "approve" ? `${controlName} approval` : actionLabels[pending]} recorded for ${detail.data?.idea.reference ?? `idea #${selectedId}`}.`); setPending(null); setReason(""); setControlName(""); await queue.refetch(); }
    catch { /* Mutation error is rendered in the drawer. */ }
  }
  function changePage(next: number) {
    if (next < 1 || next > pageCount) return;
    setSelectedId(null); setPending(null);
    if (next <= cursors.length) setPageIndex(next - 1);
    else if (next === pageIndex + 2 && queue.data?.nextAfter != null) { setCursors(current => [...current.slice(0, pageIndex + 1), queue.data!.nextAfter]); setPageIndex(next - 1); }
  }
  return <div className="stack"><div><h2 className="text-xl font-medium">{mode === "control" ? "Control reviews" : "Routed evaluations"}</h2><p className="mt-1 text-sm text-muted">{mode === "control" ? "Ideas requiring control approval." : "Ideas assigned to your account."} Decisions require a recorded reason.</p></div>
    {success && <div className="rounded-xl border border-teal/40 bg-teal/5 p-3 text-sm" role="status">{success}</div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_180px]"><label className="text-xs font-medium text-muted">Search<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Title, reference, author…" className="input mt-1" /></label><label className="text-xs font-medium text-muted">Status<select className="input mt-1" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label><label className="text-xs font-medium text-muted">Priority<select className="input mt-1" value={priority} onChange={e => setPriority(e.target.value)}><option value="">All priorities</option>{["high", "medium", "low", "unscored"].map(p => <option key={p} value={p}>{p}</option>)}</select></label></div>
    {queue.isPending ? <div className="rounded-xl border p-4 text-sm text-muted" aria-busy="true">Loading {mode === "control" ? "control reviews" : "assigned evaluations"}…</div> : queue.isError ? <div className="rounded-xl border border-pink/40 p-4" role="alert"><p className="text-sm">Evaluations unavailable: {message(queue.error)}</p><button className="btn btn-small mt-3" type="button" onClick={() => void queue.refetch()}>Try again</button></div> : <>
      {filtered.length ? <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead className="bg-[#f8faff] text-xs text-muted"><tr>{["Reference", "Idea", "Author", "AI validation / priority", "Status", "Details"].map(label => <th key={label} scope="col" className="border-b border-[var(--line)] px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{filtered.map(idea => <tr key={idea.id} className="border-b border-[var(--line)] last:border-0"><td className="whitespace-nowrap px-3 py-4 font-medium">{idea.reference}</td><td className="min-w-[240px] px-3 py-4"><button type="button" className="text-left font-medium hover:underline" onClick={() => { setSelectedId(idea.id); setPending(null); setSuccess(""); setControlName(""); decision.reset(); }}>{idea.title}</button><span className="mt-1 block text-xs text-muted">{idea.category}</span></td><td className="px-3 py-4">{idea.authorName}<span className="block text-xs text-muted">{idea.department}</span></td><td className="px-3 py-4"><span className="block">AI {idea.aiValidationScore == null ? "—" : `${idea.aiValidationScore.toFixed(1)} / 10`}</span><span className="mt-1 block text-xs text-muted">Priority {idea.priorityScore == null ? "—" : `${idea.priorityScore.toFixed(2)} / 3`} · {idea.priorityBand ?? "Unbanded"}</span>{idea.submittedWithLowAiScore && <span className="mt-1 inline-flex pill text-sand border-sand/40">Human review</span>}</td><td className="px-3 py-4 whitespace-nowrap">{idea.status.replaceAll("_", " ")}</td><td className="px-3 py-4"><button type="button" className="btn btn-small" onClick={() => { setSelectedId(idea.id); setPending(null); setSuccess(""); setControlName(""); decision.reset(); }}>Open</button></td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-[var(--line)] p-5 text-sm text-muted">{search || status || priority ? "No assigned ideas match these filters." : "No ideas are currently assigned to your account."}</p>}
      <div className="mt-4"><AdminPagination page={pageIndex + 1} pageSize={10} total={queue.data?.total ?? 0} onPageChange={changePage} busy={queue.isFetching} label="Evaluations" /></div>
    </>}
    <AdminDrawer open={selectedId !== null} onClose={() => { if (!decision.isPending && !pending) setSelectedId(null); }} title={detail.data?.idea.title ?? "Evaluation details"} description={detail.data ? `${detail.data.idea.reference} · ${detail.data.idea.status.replaceAll("_", " ")}` : undefined}>
      {detail.isPending ? <div className="p-5 text-sm text-muted" role="status" aria-busy="true">Loading evaluation detail…</div> : detail.isError ? <div className="rounded-xl border border-pink/40 p-4" role="alert"><p className="text-sm">Evaluation detail unavailable: {message(detail.error)}</p><button className="btn btn-small mt-3" type="button" onClick={() => void detail.refetch()}>Try again</button></div> : detail.data ? <><AdminIdeaFullDetail detail={detail.data} /><section className="mt-4 rounded-xl border border-[var(--line)] p-4"><h3 className="font-medium">Evaluation decision</h3><p className="mt-1 text-sm text-muted">Record your decision with a reason.</p><div className="mt-3 flex flex-wrap gap-2">{availableActions.map(action => <button key={action} type="button" className={action === "approve" ? "btn-primary" : "btn"} disabled={decision.isPending || (mode === "control" && action === "approve" && detail.data?.controlReview?.pending.length === 0)} onClick={() => { decision.reset(); setPending(action); setReason(""); setControlName(""); }}>{mode === "control" && action === "approve" ? "Approve selected control" : actionLabels[action]}</button>)}</div>
      {pending && <form className="mt-4 space-y-3 border-t border-[var(--line)] pt-4" onSubmit={event => void submit(event)}>{mode === "control" && pending === "approve" && <label className="block text-sm">Control to approve<select required className="input mt-1" value={controlName} onChange={e => setControlName(e.target.value)}><option value="">Select a pending control</option>{(detail.data.controlReview?.pending ?? []).map(name => <option key={name} value={name}>{name}</option>)}</select></label>}<label className="block text-sm">Reason<textarea autoFocus required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="input mt-1 min-h-24" /></label>{decision.isError && <p className="text-sm text-pink" role="alert">Decision failed: {message(decision.error)}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn" disabled={decision.isPending} onClick={() => setPending(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={decision.isPending || !reason.trim() || (mode === "control" && pending === "approve" && !controlName)}>{decision.isPending ? "Saving…" : "Confirm decision"}</button></div></form>}</section></> : null}
    </AdminDrawer>
  </div>;
}
