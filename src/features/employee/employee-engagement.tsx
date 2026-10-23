"use client";

import React, { useState } from "react";
import { ApiError } from "../../lib/api/client";
import { Button, Card } from "../../components/ui";
import { useEmployeeNotifications, useFeedbackCampaign, useSetEmployeeNotificationRead, useSubmitEmployeeFeedback } from "./engagement-hooks";
import type { FeedbackCategory } from "./engagement-api";

const categories: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "experience", label: "Overall experience" },
  { value: "ideas", label: "Ideas" },
  { value: "content", label: "Content" },
  { value: "technical", label: "Technical issue" },
  { value: "other", label: "Other" },
];

function messageFor(error: unknown) { return error instanceof ApiError || error instanceof Error ? error.message : "Something went wrong. Please try again."; }

export function EmployeeFeedbackCampaignForm() {
  const campaignQuery = useFeedbackCampaign();
  const submit = useSubmitEmployeeFeedback();
  const [category, setCategory] = useState<FeedbackCategory>("experience");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  if (campaignQuery.isPending) return <Card><p className="text-sm text-muted" role="status">Loading feedback campaign…</p></Card>;
  if (campaignQuery.isError) return <Card><h2 className="text-lg font-medium">Feedback is temporarily unavailable</h2><p className="mt-1 text-sm text-muted">{messageFor(campaignQuery.error)}</p><Button className="mt-3" onClick={() => void campaignQuery.refetch()}>Try again</Button></Card>;
  const campaign = campaignQuery.data.campaign;
  if (!campaign) return <Card><h2 className="text-lg font-medium">No active feedback campaign</h2><p className="mt-1 text-sm text-muted">There isn’t a campaign open right now. Check back later.</p></Card>;
  const alreadyResponded = campaignQuery.data.responses.some((response) => response.campaignId === campaign.id);
  async function sendFeedback() {
    try {
      await submit.mutateAsync({ category, message: message.trim(), idempotencyKey: globalThis.crypto.randomUUID() });
      setSubmitted(true);
      setMessage("");
    } catch { /* mutation error is displayed inline */ }
  }
  return <Card>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-[11px] font-medium uppercase tracking-[.12em] text-blue">Pinned · Feedback campaign</span><h2 className="mt-1 text-xl font-medium">{campaign.title}</h2></div><span className="pill"><span className="pill-dot" />Open</span></div>
    {campaign.description && <p className="mt-2 text-sm leading-6 text-muted">{campaign.description}</p>}
    {submitted || alreadyResponded ? <p className="mt-4 rounded-xl border border-teal/30 bg-teal/10 p-3 text-sm text-[#0e9f7a]" role="status">Thanks for sharing your feedback. Your response has been received.</p> : <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void sendFeedback(); }}>
      <label className="block"><span className="field-label">Category</span><select className="input" value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="block"><span className="field-label">Your feedback</span><textarea className="input min-h-[100px] resize-y" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} required placeholder="What would make your experience better?" /></label>
      {submit.isError && <p className="text-sm text-[#d6336c]" role="alert">{messageFor(submit.error)}</p>}
      {submit.isSuccess && <p className="text-sm text-[#0e9f7a]" role="status">Your feedback was submitted.</p>}
      <Button variant="primary" type="submit" disabled={!message.trim() || submit.isPending}>{submit.isPending ? "Sending…" : "Send feedback"}</Button>
    </form>}
  </Card>;
}

export function EmployeeNotificationsPanel() {
  const query = useEmployeeNotifications();
  const setRead = useSetEmployeeNotificationRead();
  const notifications = query.data?.items ?? [];
  return <Card>
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-medium">Notifications</h2><p className="mt-1 text-sm text-muted">{query.data?.unreadCount ?? 0} unread</p></div>{Boolean(query.data?.unreadCount) && <Button size="small" disabled={setRead.isPending} onClick={() => setRead.mutate({ all: true, read: true })}>Mark all read</Button>}</div>
    {query.isPending ? <p className="mt-4 text-sm text-muted" role="status">Loading notifications…</p> : query.isError ? <div className="mt-4"><p className="text-sm text-[#d6336c]" role="alert">{messageFor(query.error)}</p><Button className="mt-3" onClick={() => void query.refetch()}>Try again</Button></div> : notifications.length === 0 ? <p className="mt-4 text-sm text-muted">You’re all caught up. New updates will appear here.</p> : <ul className="mt-4 divide-y" style={{ borderColor: "var(--line)" }}>{notifications.map((notification) => <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0" key={notification.id}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.isRead ? "bg-[var(--line-strong)]" : "bg-blue"}`} aria-label={notification.isRead ? "Read" : "Unread"} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{notification.title}</p><p className="mt-0.5 text-sm text-muted">{notification.body}</p><time className="mt-1 block text-xs text-muted" dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleDateString()}</time></div>{!notification.isRead && <Button size="small" disabled={setRead.isPending} onClick={() => setRead.mutate({ id: notification.id, read: true })}>Mark read</Button>}</li>)}</ul>}
    {setRead.isError && <p className="mt-3 text-sm text-[#d6336c]" role="alert">{messageFor(setRead.error)}</p>}
  </Card>;
}
