"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Card } from "../../../components/ui";
import { useAdminEvaluation, useAdminEvaluationDecision, useAdminRoutedEvaluations } from "../hooks";
import type { AdminEvaluationDetail } from "../types";
import type { EvaluationAction } from "../api";

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

function EvaluationDetail({ detail }: { detail: AdminEvaluationDetail }) {
  const { idea, submission } = detail;
  const metrics = submission?.metrics;
  return <div className="space-y-4">
    <Card><div className="flex flex-wrap items-center gap-2"><span className="pill">{idea.reference}</span><span className="pill">{idea.status.replaceAll("_", " ")}</span><span className="ml-auto text-xs text-muted">{idea.category}</span></div><h2 className="mt-3 text-2xl font-medium">{idea.title}</h2><p className="mt-2 text-sm text-muted">{idea.authorName} · {idea.department} · Submitted {new Date(submission?.submittedAt ?? idea.createdAt).toLocaleDateString()}</p><p className="mt-4 whitespace-pre-wrap">{idea.summary}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Problem", idea.problem], ["Solution", idea.solution], ["Benefits", idea.benefits], ["Risks", idea.risks]].map(([label, value]) => <div key={label} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><h3 className="text-xs text-muted">{label}</h3><p className="mt-1 whitespace-pre-wrap text-sm">{value || "Not provided"}</p></div>)}</div></Card>
    <Card><h3 className="text-lg font-medium">Five evaluation answers</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2">{answerFields.map(([key, label]) => <div key={key} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{display(submission?.answers?.[key])}</dd></div>)}</dl>{submission?.differentiation && <p className="mt-3 text-sm"><span className="text-muted">Differentiation: </span>{submission.differentiation}</p>}</Card>
    <Card><h3 className="text-lg font-medium">KPI metrics and score breakdown</h3>{submission ? <><div className="mt-3 grid gap-3 sm:grid-cols-3">{["turnaround", "volume", "value"].map((key) => <div key={key} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><p className="text-xs text-muted">{metricLabels[key]}</p><p className="mt-1 text-xl font-medium">{display(metrics?.[key])} <span className="text-sm text-muted">/ 3</span></p></div>)}</div><div className="mt-4 space-y-2">{(submission.breakdown ?? []).map((item) => <div key={item.key} className="flex flex-wrap items-start gap-2 rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><b className="min-w-24 text-sm">{metricLabels[item.key] ?? item.key}</b><span className="text-sm">Score {display(item.score)} · Weight {(item.weight * 100).toFixed(0)}%</span><span className="ml-auto text-sm text-muted">Weighted {typeof item.score === "number" ? (item.score * item.weight).toFixed(2) : "—"}</span><p className="w-full text-sm text-muted">{item.explanation || "No explanation provided."}</p></div>)}</div><div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-[var(--hover)] p-3"><b className="text-xl">{submission.score.toFixed(2)}</b><span className="text-sm text-muted">Weighted score · minimum {submission.minimumScore.toFixed(2)}</span><span className={`pill ${submission.validationPassed ? "text-teal border-teal/40" : "text-sand border-sand/40"}`}>{submission.validationPassed ? "Validation passed" : "Below minimum"}</span></div></> : <p className="mt-2 text-sm text-muted">No submitted KPI data is available.</p>}</Card>
    <Card><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-medium">AI assessment</h3>{detail.assessment && <span className="text-xs text-muted">{detail.assessment.jobKey} · {detail.assessment.completedAt ? new Date(detail.assessment.completedAt).toLocaleString() : "Completed"}</span>}</div><Assessment result={detail.assessment?.result} /></Card>
  </div>;
}

export function AdminEvaluation() {
  const queue = useAdminRoutedEvaluations();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const detail = useAdminEvaluation(selectedId);
  const decision = useAdminEvaluationDecision();
  const [pending, setPending] = useState<EvaluationAction | null>(null);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !pending || !reason.trim()) return;
    try {
      await decision.mutateAsync({ ideaId: selectedId, action: pending, reason: reason.trim() });
      setSuccess(`${actionLabels[pending]} recorded for ${detail.data?.idea.reference ?? `idea #${selectedId}`}.`);
      setPending(null);
      setReason("");
      await queue.refetch();
    } catch { /* mutation error is rendered in the confirmation dialog */ }
  }

  return <div className="stack"><div><h2 className="text-xl font-medium">Routed evaluations</h2><p className="mt-1 text-sm text-muted">Owner assigned ideas · governed decisions require a recorded reason.</p></div>
    {success && <div className="rounded-xl border border-teal/40 bg-teal/5 p-3 text-sm" role="status">{success}</div>}
    {queue.isPending ? <div className="rounded-xl border p-4 text-sm text-muted" aria-busy="true">Loading routed evaluations…</div> : queue.isError ? <div className="rounded-xl border border-pink/40 p-4" role="alert"><p className="text-sm">Routed evaluations unavailable: {message(queue.error)}</p><button className="btn btn-small mt-3" onClick={() => void queue.refetch()}>Try again</button></div> : !queue.data?.items.length ? <div className="rounded-xl border p-4 text-sm text-muted">No ideas are currently routed to your account.</div> : <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.5fr)]"><Card className="h-fit"><h3 className="mb-3 font-medium">Assigned ideas</h3><div className="space-y-2">{queue.data.items.map((idea) => <button key={idea.id} type="button" onClick={() => { setSelectedId(idea.id); setSuccess(""); decision.reset(); }} aria-pressed={selectedId === idea.id} className={`w-full rounded-xl border p-3 text-left ${selectedId === idea.id ? "border-blue bg-blue/5" : ""}`} style={{ borderColor: selectedId === idea.id ? undefined : "var(--line)" }}><span className="text-xs text-muted">{idea.reference} · {idea.status.replaceAll("_", " ")}</span><span className="mt-1 block font-medium">{idea.title}</span><span className="mt-1 block text-xs text-muted">{idea.authorName} · {idea.department}</span></button>)}</div></Card><div className="min-w-0">{selectedId === null ? <div className="rounded-xl border p-5 text-sm text-muted">Select an assigned idea to review its evidence.</div> : detail.isPending ? <div className="rounded-xl border p-5 text-sm text-muted" aria-busy="true">Loading evaluation detail…</div> : detail.isError ? <div className="rounded-xl border border-pink/40 p-4" role="alert"><p className="text-sm">Evaluation detail unavailable: {message(detail.error)}</p><button className="btn btn-small mt-3" onClick={() => void detail.refetch()}>Try again</button></div> : detail.data ? <><EvaluationDetail detail={detail.data} /><Card className="mt-4"><h3 className="font-medium">Evaluation decision</h3><p className="mt-1 text-sm text-muted">Your decision is recorded with your reason and authenticated administrator session.</p><div className="mt-3 flex flex-wrap gap-2">{(["approve", "return", "not_recommended"] as const).map((action) => <button key={action} type="button" className={action === "approve" ? "btn-primary" : "btn"} disabled={decision.isPending} onClick={() => { decision.reset(); setPending(action); setReason(""); }}>{actionLabels[action]}</button>)}</div></Card></> : null}</div></div>}
    <Dialog open={pending !== null} onClose={() => !decision.isPending && setPending(null)} className="relative z-50"><div className="fixed inset-0 bg-black/40" aria-hidden="true"/><div className="fixed inset-0 flex items-center justify-center p-4"><DialogPanel className="w-full max-w-lg rounded-2xl border bg-[var(--card)] p-5 shadow-xl" style={{ borderColor: "var(--line)" }}><DialogTitle className="text-lg font-medium">{pending ? actionLabels[pending] : "Evaluation decision"} · {detail.data?.idea.reference}</DialogTitle><form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}><label className="block text-sm">Reason<textarea autoFocus required minLength={1} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border bg-transparent p-3" /></label><p className="text-xs text-muted">Required, up to 500 characters.</p>{decision.isError && <div className="rounded-xl border border-pink/40 bg-pink/5 p-3 text-sm" role="alert">Decision failed: {message(decision.error)}</div>}<div className="flex justify-end gap-2"><button type="button" className="btn" disabled={decision.isPending} onClick={() => setPending(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={decision.isPending || !reason.trim()}>{decision.isPending ? "Saving…" : "Confirm decision"}</button></div></form></DialogPanel></div></Dialog>
  </div>;
}
