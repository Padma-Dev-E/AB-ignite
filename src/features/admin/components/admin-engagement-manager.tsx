"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Button, Card } from "../../../components/ui";
import { useAdminAnnouncements, useAdminCampaigns, useAdminEngagementCommand, useManagedChallenges } from "../engagement-hooks";
import type { EngagementCommand } from "../engagement-api";

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "The request could not be completed."; }
function QueryState({ query, empty, children }: { query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }; empty: boolean; children: ReactNode }) {
  if (query.isPending) return <p className="text-sm text-muted" role="status" aria-busy="true">Loading…</p>;
  if (query.isError) return <div role="alert"><p className="text-sm text-[#d6336c]">{errorMessage(query.error)}</p><button type="button" className="btn mt-2" onClick={() => void query.refetch()}>Try again</button></div>;
  return empty ? <p className="text-sm text-muted">No items configured yet.</p> : children;
}

function PagedItems<T extends { id: number }>({ items, label, render }: { items: T[]; label: string; render: (item: T) => ReactNode }) {
  const [requestedPage, setRequestedPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  return <><ul className="space-y-3">{items.slice((page - 1) * pageSize, page * pageSize).map(item => <li key={item.id}>{render(item)}</li>)}</ul>{totalPages > 1 && <nav aria-label={`${label} pages`} className="mt-4 flex items-center justify-between gap-3 text-sm"><button type="button" className="btn btn-small" disabled={page === 1} onClick={() => setRequestedPage(page - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="btn btn-small" disabled={page >= totalPages} onClick={() => setRequestedPage(page + 1)}>Next</button></nav>}</>;
}

type PendingAction = { command: EngagementCommand; label: string; idempotencyKey: string };
export function AdminEngagementManager() {
  const announcements = useAdminAnnouncements();
  const campaigns = useAdminCampaigns();
  const challenges = useManagedChallenges();
  const mutation = useAdminEngagementCommand();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState("");
  const [validation, setValidation] = useState("");
  const submitting = useRef(false);
  const announcementForm = useRef<HTMLFormElement>(null);
  const challengeForm = useRef<HTMLFormElement>(null);
  function prepare(command: EngagementCommand, label: string) {
    mutation.reset(); setReason(""); setSuccess(""); setValidation("");
    setPending({ command, label, idempotencyKey: `admin-engagement:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}` });
  }
  function createAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const body = String(data.get("body") ?? "").trim();
    if (!title || !body) { setValidation("Enter an announcement title and message."); return; }
    prepare({ kind: "announcement-create", title, body }, `Create announcement: ${title}`);
  }
  function createChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const question = String(data.get("question") ?? "").trim();
    const deadline = new Date(String(data.get("deadline") ?? ""));
    if (!title || !question || !Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now()) { setValidation("Enter a challenge title, question and future deadline."); return; }
    prepare({ kind: "challenge-create", title, question, deadlineAt: deadline.toISOString(), active: true }, `Create open challenge: ${title}`);
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending || submitting.current || !reason.trim() || reason.trim().length > 500) return;
    submitting.current = true;
    try {
      await mutation.mutateAsync({ command: pending.command, reason: reason.trim(), idempotencyKey: pending.idempotencyKey });
      if (pending.command.kind === "announcement-create") announcementForm.current?.reset();
      if (pending.command.kind === "challenge-create") challengeForm.current?.reset();
      setSuccess(`${pending.label} — saved.`); setPending(null);
    } catch { /* Keep the same command and key for a safe retry. */ }
    finally { submitting.current = false; }
  }
  return <div className="space-y-5">
    {success && <p className="rounded-xl border border-teal/40 p-3 text-sm" role="status">{success}</p>}
    {validation && <p className="text-sm text-[#d6336c]" role="alert">{validation}</p>}
    <Card><h2 className="text-xl font-medium">Announcements</h2><p className="mt-1 text-sm text-muted">Pinning replaces the previous pin and notifies employees.</p>
      <form ref={announcementForm} onSubmit={createAnnouncement} className="my-4 space-y-3">
        <label className="block text-sm">Title<input name="title" className="input mt-1 w-full" required maxLength={240} /></label>
        <label className="block text-sm">Message<textarea name="body" className="input mt-1 min-h-24 w-full" required maxLength={4000} /></label>
        <Button type="submit" className="btn-primary" disabled={!!pending}>Create announcement</Button>
      </form>
      <QueryState query={announcements} empty={!announcements.data?.items.length}><PagedItems items={announcements.data?.items ?? []} label="Announcements" render={item => <div className="rounded-xl border border-[var(--line)] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="break-words font-medium">{item.title}</h3><button type="button" className="btn btn-small" disabled={!!pending} onClick={() => prepare({ kind: "announcement-pin", id: item.id, pinned: !item.pinned }, `${item.pinned ? "Unpin" : "Pin"} announcement: ${item.title}`)}>{item.pinned ? "Unpin" : "Pin"}</button></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{item.body}</p><p className="mt-2 text-xs text-muted">{item.pinned ? "Pinned" : "Not pinned"}</p></div>} /></QueryState>
    </Card>
    <Card><h2 className="mb-4 text-xl font-medium">Feedback campaigns</h2>
      <QueryState query={campaigns} empty={!campaigns.data?.items.length}><PagedItems items={campaigns.data?.items ?? []} label="Campaigns" render={item => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3"><div className="min-w-0"><h3 className="break-words font-medium">{item.title}</h3><p className="text-sm text-muted">{item.active ? "Open" : "Closed"}{item.pinned ? " · Pinned" : ""}</p>{item.description && <p className="mt-1 break-words text-sm text-muted">{item.description}</p>}</div><button type="button" className="btn btn-small" disabled={!!pending || (!item.active && !!item.endsAt && new Date(item.endsAt).getTime() <= Date.now())} onClick={() => prepare({ kind: "campaign-status", id: item.id, active: !item.active }, `${item.active ? "Close" : "Open"} campaign: ${item.title}`)}>{item.active ? "Close campaign" : item.endsAt && new Date(item.endsAt).getTime() <= Date.now() ? "Expired" : "Open campaign"}</button></div>} /></QueryState>
    </Card>
    <Card><h2 className="text-xl font-medium">Challenges</h2><p className="mt-1 text-sm text-muted">Create an open challenge. Closed challenges cannot be reopened.</p>
      <form ref={challengeForm} onSubmit={createChallenge} className="my-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">Title<input name="title" className="input mt-1 w-full" required maxLength={240} /></label>
        <label className="block text-sm">Deadline (your local time)<input name="deadline" type="datetime-local" className="input mt-1 w-full" required /></label>
        <label className="block text-sm sm:col-span-2">Question<textarea name="question" className="input mt-1 min-h-24 w-full" required maxLength={3000} /></label>
        <Button type="submit" className="btn-primary justify-self-start" disabled={!!pending}>Create challenge</Button>
      </form>
      <QueryState query={challenges} empty={!challenges.data?.length}><PagedItems items={challenges.data ?? []} label="Challenges" render={item => <div className="rounded-xl border border-[var(--line)] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="break-words font-medium">{item.title}</h3>{item.active && <button type="button" className="btn btn-small" disabled={!!pending} onClick={() => prepare({ kind: "challenge-close", id: item.id }, `Close challenge: ${item.title}`)}>Close challenge</button>}</div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{item.question}</p><p className="mt-2 text-xs text-muted">{!item.active ? "Closed" : new Date(item.deadlineAt).getTime() <= Date.now() ? "Expired" : "Open"} · Deadline: {new Date(item.deadlineAt).toLocaleString()} · {item.points} points</p></div>} /></QueryState>
    </Card>
    <Dialog open={!!pending} onClose={() => { if (!submitting.current) setPending(null); }} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" /><div className="fixed inset-0 overflow-y-auto p-4"><DialogPanel className="mx-auto my-12 w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-xl">
        <DialogTitle className="break-words text-lg font-medium">{pending?.label}</DialogTitle>
        <form onSubmit={confirm} className="mt-4 space-y-3" aria-busy={mutation.isPending}>
          <label className="block text-sm">Audit reason<textarea autoFocus className="input mt-1 min-h-24 w-full" required maxLength={500} value={reason} disabled={mutation.isPending || mutation.isError} onChange={event => setReason(event.target.value)} /></label>
          <p className="text-xs text-muted">Required, up to 500 characters. This action is recorded in the audit log.</p>
          {mutation.isError && <p role="alert" className="text-sm text-[#d6336c]">{errorMessage(mutation.error)} Retry sends the same request safely. Close to change the reason.</p>}
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" className="btn" disabled={mutation.isPending} onClick={() => setPending(null)}>Cancel</Button><Button type="submit" className="btn-primary" disabled={mutation.isPending || !reason.trim()}>{mutation.isPending ? "Saving…" : mutation.isError ? "Retry action" : "Confirm action"}</Button></div>
        </form>
      </DialogPanel></div>
    </Dialog>
  </div>;
}
