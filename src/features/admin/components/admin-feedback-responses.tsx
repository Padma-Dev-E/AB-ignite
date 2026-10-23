"use client";

import React, { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../components/ui";
import { adminQueryKeys } from "../api";
import { useAdminFeedbackResponse } from "../hooks";
import { listAdminFeedbackPage } from "../standalone-list-api";
import type { AdminFeedbackResponse } from "../types";
import { AdminDrawer, AdminPagination } from "./admin-data-ui";

export type AdminFeedbackResponsesProps = { className?: string };

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function AdminFeedbackResponses({ className = "" }: AdminFeedbackResponsesProps) {
  const [cursors, setCursors] = useState<(number | null)[]>([null]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [selected, setSelected] = useState<AdminFeedbackResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const feedback = useQuery({ queryKey: [...adminQueryKeys.feedback, cursors[page - 1]], queryFn: () => listAdminFeedbackPage(cursors[page - 1]) });
  const respond = useAdminFeedbackResponse();

  async function goToPage(target: number) {
    const cursorIndex = target - 1;
    if (cursorIndex >= cursors.length) return;
    if (target === cursors.length && feedback.data?.nextAfter != null) {
      const next = feedback.data.nextAfter;
      setCursors(current => [...current.slice(0, cursorIndex), next]);
    }
    setPage(target);
  }

  function resetFilters(update: () => void) { update(); setPage(1); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const response = draft.trim();
    if (!response || response.length > 2000) return;
    setError(""); setSuccess("");
    try {
      await respond.mutateAsync({ id: selected.id, response });
      setDraft(""); setSuccess("Response sent.");
      setSelected({ ...selected, response, respondedAt: new Date().toISOString() });
      void feedback.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your response could not be sent.");
    }
  }

  if (feedback.isPending) return <section className={`app-card ${className}`} aria-busy="true"><p className="text-sm text-muted" role="status">Loading campaign feedback…</p></section>;
  if (feedback.isError) return <section className={`app-card ${className}`}><p className="text-sm text-[#d6336c]" role="alert">{feedback.error instanceof Error ? feedback.error.message : "Feedback could not be loaded."}</p><button type="button" className="btn mt-3" onClick={() => void feedback.refetch()}>Try again</button></section>;

  const items = Array.isArray(feedback.data?.items) ? feedback.data.items : [];
  const campaigns = Array.from(new Set(items.map(item => item.campaignId))).sort((a, b) => a - b);
  const needle = search.trim().toLowerCase();
  const filtered = items.filter(item => {
    const matchesSearch = !needle || [item.userName, item.userId, item.category, item.message, item.response, item.campaignId].some(value => String(value ?? "").toLowerCase().includes(needle));
    const matchesStatus = status === "all" || (status === "responded" ? Boolean(item.respondedAt || item.response) : !item.respondedAt && !item.response);
    const matchesCampaign = campaign === "all" || String(item.campaignId) === campaign;
    return matchesSearch && matchesStatus && matchesCampaign;
  });
  const total = feedback.data?.total ?? (feedback.data?.nextAfter != null ? Math.max(items.length + 1, (page - 1) * 10 + items.length + 1) : (page - 1) * 10 + items.length);

  return <section className={`app-card ${className}`}>
    <div className="mb-5"><h2 className="text-xl font-medium">Campaign feedback</h2><p className="mt-1 text-sm text-muted">Review employee responses and reply to feedback that has not been answered.</p></div>
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <label className="text-sm"><span className="field-label">Search responses</span><input className="input mt-1" type="search" value={search} onChange={event => resetFilters(() => setSearch(event.target.value))} placeholder="Employee, category, message…" /></label>
      <label className="text-sm"><span className="field-label">Status</span><select className="input mt-1" value={status} onChange={event => resetFilters(() => setStatus(event.target.value))}><option value="all">All statuses</option><option value="unanswered">Unanswered</option><option value="responded">Responded</option></select></label>
      <label className="text-sm"><span className="field-label">Campaign</span><select className="input mt-1" value={campaign} onChange={event => resetFilters(() => setCampaign(event.target.value))}><option value="all">All campaigns</option>{campaigns.map(id => <option key={id} value={id}>Campaign {id}</option>)}</select></label>
    </div>
    {filtered.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted" style={{ borderColor: "var(--line)" }}>{items.length === 0 ? "There are no campaign responses yet." : "No responses match these filters on this page."}</p> : <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--line)" }}><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#f4f7fb] text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Campaign</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"><span className="sr-only">Details</span></th></tr></thead><tbody className="divide-y" style={{ borderColor: "var(--line)" }}>{filtered.map(item => <tr key={item.id} className="align-middle"><td className="px-4 py-3"><p className="font-medium">{item.userName || "Employee"}</p><p className="text-xs text-muted">Employee #{item.userId}</p></td><td className="px-4 py-3">Campaign {item.campaignId}</td><td className="px-4 py-3">{item.category || "Uncategorized"}</td><td className="px-4 py-3 whitespace-nowrap">{dateLabel(item.createdAt)}</td><td className="px-4 py-3">{item.respondedAt || item.response ? "Responded" : "Unanswered"}</td><td className="px-4 py-3 text-right"><button type="button" className="btn btn-small" onClick={() => { setSelected(item); setDraft(""); setError(""); setSuccess(""); }}>View details</button></td></tr>)}</tbody></table></div>}
    <div className="mt-4"><AdminPagination page={page} pageSize={10} total={total} onPageChange={number => void goToPage(number)} busy={feedback.isFetching} label="Campaign feedback" /></div>
    <AdminDrawer open={selected !== null} onClose={() => setSelected(null)} title="Feedback details" description={selected ? `Campaign ${selected.campaignId} · ${selected.userName || "Employee"}` : undefined} footer={selected && !selected.response && !selected.respondedAt ? <Button variant="primary" type="submit" form="feedback-response-form" disabled={respond.isPending || !draft.trim()}>{respond.isPending ? "Sending…" : "Send response"}</Button> : undefined}>
      {selected && <div className="space-y-5"><dl className="grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2" style={{ borderColor: "var(--line)" }}><div><dt className="text-xs text-muted">Employee</dt><dd className="mt-1 font-medium">{selected.userName || "Employee"} · #{selected.userId}</dd></div><div><dt className="text-xs text-muted">Category</dt><dd className="mt-1">{selected.category || "Uncategorized"}</dd></div><div><dt className="text-xs text-muted">Submitted</dt><dd className="mt-1">{dateLabel(selected.createdAt)}</dd></div><div><dt className="text-xs text-muted">Campaign</dt><dd className="mt-1">{selected.campaignId}</dd></div></dl><section><h3 className="text-sm font-medium">Employee response</h3><p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-[#f4f7fb] p-4 text-sm">{selected.message || "No message provided."}</p></section>{selected.response || selected.respondedAt ? <section className="rounded-xl bg-teal/5 p-4"><h3 className="text-sm font-medium">Administrator reply{selected.respondedAt ? ` · ${dateLabel(selected.respondedAt)}` : ""}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{selected.response || "Response recorded."}</p></section> : <form id="feedback-response-form" className="space-y-2" onSubmit={event => void submit(event)}><label className="block text-sm"><span className="field-label">Your response</span><textarea className="input mt-1 min-h-32 resize-y" value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} required aria-describedby="feedback-response-help" /></label><p id="feedback-response-help" className="text-xs text-muted">Up to 2000 characters.</p>{error && <p className="text-sm text-[#d6336c]" role="alert">{error}</p>}{success && <p className="text-sm text-[#0e9f7a]" role="status">{success}</p>}</form>}</div>}
    </AdminDrawer>
  </section>;
}

export default AdminFeedbackResponses;
