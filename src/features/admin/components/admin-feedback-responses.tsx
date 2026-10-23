"use client";

import { useState, type FormEvent } from "react";
import { Button } from "../../../components/ui";
import { useAdminFeedback, useAdminFeedbackResponse } from "../hooks";

export type AdminFeedbackResponsesProps = { className?: string };

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function AdminFeedbackResponses({ className = "" }: AdminFeedbackResponsesProps) {
  const feedback = useAdminFeedback();
  const respond = useAdminFeedbackResponse();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [success, setSuccess] = useState<Record<number, string>>({});

  if (feedback.isPending) return <section className={`app-card ${className}`} aria-busy="true"><p className="text-sm text-muted" role="status">Loading campaign feedback…</p></section>;
  if (feedback.isError) return <section className={`app-card ${className}`}><p className="text-sm text-[#d6336c]" role="alert">{feedback.error instanceof Error ? feedback.error.message : "Feedback could not be loaded."}</p><button type="button" className="btn mt-3" onClick={() => void feedback.refetch()}>Try again</button></section>;

  const items = Array.isArray(feedback.data?.items) ? feedback.data.items : [];
  const campaigns = new Map<number, typeof items>();
  for (const item of items) campaigns.set(item.campaignId, [...(campaigns.get(item.campaignId) ?? []), item]);

  async function submit(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    const response = (drafts[id] ?? "").trim();
    if (!response || response.length > 2000) return;
    setErrors((current) => ({ ...current, [id]: "" }));
    setSuccess((current) => ({ ...current, [id]: "" }));
    try {
      await respond.mutateAsync({ id, response });
      setDrafts((current) => ({ ...current, [id]: "" }));
      setSuccess((current) => ({ ...current, [id]: "Response sent." }));
    } catch (cause) {
      setErrors((current) => ({ ...current, [id]: cause instanceof Error ? cause.message : "Your response could not be sent." }));
    }
  }

  return <section className={`app-card ${className}`}>
    <div className="mb-5"><h2 className="text-xl font-medium">Campaign feedback</h2><p className="mt-1 text-sm text-muted">Review employee responses and reply to feedback that has not been answered.</p></div>
    {items.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted" style={{ borderColor: "var(--line)" }}>There are no campaign responses yet.</p> : <div className="space-y-6">{Array.from(campaigns, ([campaignId, responses]) => <section key={campaignId} aria-labelledby={`feedback-campaign-${campaignId}`}>
      <h3 id={`feedback-campaign-${campaignId}`} className="mb-3 text-lg font-medium">Campaign {campaignId}</h3>
      <div className="space-y-3">{responses.map((item) => <article key={item.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)" }}>
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{item.category || "Uncategorized"}</p><p className="mt-1 text-sm text-muted">{item.userName || "Employee"} · Employee #{item.userId}</p></div><time className="text-xs text-muted" dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></div>
        <p className="mt-3 whitespace-pre-wrap text-sm">{item.message || "No message provided."}</p>
        {item.respondedAt || item.response ? <div className="mt-4 rounded-lg bg-teal/5 p-3"><p className="text-xs font-medium text-muted">Response{item.respondedAt ? ` · ${dateLabel(item.respondedAt)}` : ""}</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.response || "Response recorded."}</p></div> : <form className="mt-4 space-y-2" onSubmit={(event) => void submit(event, item.id)}>
          <label className="block text-sm"><span className="field-label">Your response</span><textarea className="input mt-1 min-h-24 resize-y" value={drafts[item.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={2000} required aria-describedby={`feedback-response-help-${item.id}`} /></label>
          <p id={`feedback-response-help-${item.id}`} className="text-xs text-muted">Up to 2000 characters.</p>
          {errors[item.id] && <p className="text-sm text-[#d6336c]" role="alert">{errors[item.id]}</p>}
          {success[item.id] && <p className="text-sm text-[#0e9f7a]" role="status">{success[item.id]}</p>}
          <Button variant="primary" type="submit" disabled={respond.isPending || !(drafts[item.id] ?? "").trim()}>{respond.isPending ? "Sending…" : "Send response"}</Button>
        </form>}
      </article>)}</div>
    </section>)}</div>}
  </section>;
}

export default AdminFeedbackResponses;
