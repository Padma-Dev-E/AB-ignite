"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { AdminUser } from "../types";
import { useCreatePerson, usePeopleUsers, usePersonSessions, useResetPersonPassword, useResetPersonSignInSecurity, useRevokePersonSession, useUpdatePersonActivation, useUpdatePersonRole } from "../people-hooks";

type Operation = { user: AdminUser; kind: "role" | "activation" | "security" | "password"; value?: AdminUser["profile"] | boolean };

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function PersonSessions({ userId }: { userId: number }) {
  const sessions = usePersonSessions(userId);
  const revoke = useRevokePersonSession();
  if (sessions.isPending) return <p className="p-4 text-sm text-muted" role="status">Loading sessions…</p>;
  if (sessions.isError) return <div className="p-4" role="alert"><p className="text-sm text-[#d6336c]">Sessions could not be loaded: {errorText(sessions.error)}</p><button className="btn btn-small mt-2" onClick={() => void sessions.refetch()}>Retry</button></div>;
  const items = sessions.data?.items ?? [];
  if (!items.length) return <p className="p-4 text-sm text-muted">No sessions recorded.</p>;
  return <div className="divide-y" style={{ borderColor: "var(--line)" }}>{items.map((session) => <article key={session.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm"><span className={`pill ${session.isActive ? "text-teal" : "text-muted"}`}>{session.isActive ? "Active" : session.revokedAt ? "Revoked" : "Expired"}</span><span>Started {formatDate(session.createdAt)}</span><span className="text-muted">Last seen {formatDate(session.lastSeenAt)}</span><span className="text-muted">Expires {formatDate(session.expiresAt)}</span>{session.revocationReason && <span className="text-xs text-muted">{session.revocationReason}</span>}{session.isActive && <button type="button" className="btn btn-small" disabled={revoke.isPending} onClick={() => { const reason = window.prompt("Reason for revoking this session:"); if (reason?.trim()) void revoke.mutateAsync({ userId, sessionId: session.id, reason: reason.trim() }).then(() => void sessions.refetch()).catch(() => undefined); }}>Revoke</button>}</article>)}</div>;
}

export type AdminPeopleManagementProps = { className?: string; currentUserId?: number };

/** Standalone people controls. Role/activation/security writes require a reason and are audited server-side. */
export function AdminPeopleManagement({ className = "", currentUserId }: AdminPeopleManagementProps) {
  const people = usePeopleUsers();
  const roleMutation = useUpdatePersonRole();
  const activationMutation = useUpdatePersonActivation();
  const securityMutation = useResetPersonSignInSecurity();
  const passwordMutation = useResetPersonPassword();
  const createMutation = useCreatePerson();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pending, setPending] = useState<Operation | null>(null);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", department: "", jobTitle: "", profile: "employee" as AdminUser["profile"], reason: "" });
  const mutation = pending?.kind === "role" ? roleMutation : pending?.kind === "activation" ? activationMutation : pending?.kind === "password" ? passwordMutation : securityMutation;
  const filtered = useMemo(() => (people.data?.items ?? []).filter((user) => `${user.name} ${user.email} ${user.department} ${user.jobTitle ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [people.data, search]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending || !reason.trim()) return;
    setSuccess("");
    try {
      if (pending.kind === "role") await roleMutation.mutateAsync({ userId: pending.user.id, profile: pending.value as AdminUser["profile"], reason: reason.trim() });
      else if (pending.kind === "activation") await activationMutation.mutateAsync({ userId: pending.user.id, active: pending.value as boolean, reason: reason.trim() });
      else if (pending.kind === "password") { const result = await passwordMutation.mutateAsync({ userId: pending.user.id, reason: reason.trim() }); setSuccess(`${pending.user.name}: temporary password generated (${result.temporaryPassword}). Deliver it through an approved bank channel.`); }
      else await securityMutation.mutateAsync({ userId: pending.user.id, reason: reason.trim() });
      if (pending.kind !== "password") setSuccess(`${pending.user.name}: ${pending.kind === "security" ? "sign-in security reset" : pending.kind === "role" ? `profile changed to ${pending.value}` : pending.value ? "account activated" : "account deactivated"}.`);
      setPending(null);
      setReason("");
    } catch { /* Mutation error is rendered in the confirmation form. */ }
  }

  const title = pending?.kind === "role" ? `Change ${pending.user.name}'s profile` : pending?.kind === "activation" ? `${pending.value ? "Activate" : "Deactivate"} ${pending.user.name}` : pending?.kind === "password" ? `Reset password for ${pending.user.name}` : `Reset sign-in security for ${pending?.user.name ?? "user"}`;

  return <section className={`app-card ${className}`}>
    <details className="mb-5 rounded-xl border p-4" style={{ borderColor: "var(--line)" }}><summary className="cursor-pointer font-medium">Create user</summary><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void createMutation.mutateAsync(newUser).then((result) => { setSuccess(`Created ${result.user.email}. Temporary password: ${result.temporaryPassword}`); setNewUser({ name: "", email: "", department: "", jobTitle: "", profile: "employee", reason: "" }); }).catch(() => undefined); }}><input className="input" required placeholder="Name" value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} /><input className="input" required type="email" placeholder="Email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} /><input className="input" required placeholder="Department" value={newUser.department} onChange={(event) => setNewUser({ ...newUser, department: event.target.value })} /><select className="input" value={newUser.profile} onChange={(event) => setNewUser({ ...newUser, profile: event.target.value as AdminUser["profile"] })}><option value="employee">Employee</option><option value="reviewer">Reviewer</option><option value="business_owner">Business owner</option><option value="control">Control</option><option value="management">Management</option><option value="admin">Admin</option></select><textarea className="input sm:col-span-2" required maxLength={500} placeholder="Audited reason" value={newUser.reason} onChange={(event) => setNewUser({ ...newUser, reason: event.target.value })} /><button className="btn-primary sm:col-span-2" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating…" : "Create user"}</button>{createMutation.isError && <p className="text-sm text-[#d6336c]" role="alert">{errorText(createMutation.error)}</p>}</form></details>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-medium">People & access</h2><p className="mt-1 text-sm text-muted">Manage account roles, access state, sign-in recovery and review session activity.</p></div><label className="w-full sm:max-w-xs"><span className="field-label">Search people</span><input className="input mt-1" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or department" /></label></div>
    {success && <p className="mb-4 rounded-xl border border-teal/40 bg-teal/5 p-3 text-sm" role="status">{success}</p>}
    {people.isPending ? <div className="py-10 text-center text-sm text-muted" role="status" aria-busy="true">Loading people…</div> : people.isError ? <div className="rounded-xl border border-pink/40 p-4" role="alert"><p className="text-sm">People could not be loaded: {errorText(people.error)}</p><button type="button" className="btn btn-small mt-3" onClick={() => void people.refetch()}>Retry</button></div> : filtered.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted" style={{ borderColor: "var(--line)" }}>{search ? "No people match this search." : "No users found."}</p> : <div className="space-y-3">{filtered.map((user) => {
      const isSelf = user.id === currentUserId;
      const status = user.isActive ? "Active" : "Deactivated";
      return <article key={user.id} className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}><div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{user.name}</h3><span className="pill">{user.role}</span><span className={`pill ${user.isActive ? "text-teal" : "text-pink"}`}>{status}</span></div><p className="mt-1 break-all text-sm text-muted">{user.email} · {user.department}{user.jobTitle ? ` · ${user.jobTitle}` : ""}</p><p className="mt-1 text-xs text-muted">Last sign-in {formatDate(user.lastLoginAt)} · Last activity {formatDate(user.lastSeenAt)}{user.lockedUntil ? ` · Locked until ${formatDate(user.lockedUntil)}` : ""}{user.failedLoginAttempts ? ` · ${user.failedLoginAttempts} failed attempts` : ""}</p></div>
        <div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor={`role-${user.id}`}>Profile for {user.name}</label><select id={`role-${user.id}`} className="input min-w-40" value={user.profile} disabled={isSelf || roleMutation.isPending} onChange={(event) => setPending({ user, kind: "role", value: event.target.value as AdminUser["profile"] })}><option value="employee">Employee</option><option value="reviewer">Reviewer</option><option value="business_owner">Business owner</option><option value="control">Control</option><option value="management">Management</option><option value="admin">Admin</option></select><button type="button" className="btn btn-small" disabled={isSelf || activationMutation.isPending} onClick={() => setPending({ user, kind: "activation", value: !user.isActive })}>{user.isActive ? "Deactivate" : "Activate"}</button><button type="button" className="btn btn-small" disabled={securityMutation.isPending} onClick={() => setPending({ user, kind: "security" })}>Reset sign-in</button><button type="button" className="btn btn-small" aria-expanded={expandedId === user.id} onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}>{expandedId === user.id ? "Hide sessions" : "Sessions"}</button></div>
      </div>{expandedId === user.id && <div className="border-t bg-[var(--hover)]" style={{ borderColor: "var(--line)" }}><div className="px-4 pt-3"><h4 className="text-sm font-medium">Sessions</h4><p className="text-xs text-muted">Session tokens are never displayed.</p></div><PersonSessions userId={user.id} /><p className="px-4 pb-3 text-xs text-muted">Session revocation is not available in the current backend.</p></div>}</article>;
    })}</div>}
    {people.data?.nextAfter !== null && people.data?.nextAfter !== undefined && <p className="mt-3 text-xs text-muted">Showing the first {people.data.items.length} users. The server returned another page; pagination is not exposed in this component yet.</p>}

    {pending && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !mutation.isPending) setPending(null); }}><section role="dialog" aria-modal="true" aria-labelledby="people-confirm-title" className="w-full max-w-lg rounded-2xl border bg-[var(--card)] p-5 shadow-xl" style={{ borderColor: "var(--line)" }}><h3 id="people-confirm-title" className="text-lg font-medium">{title}</h3><p className="mt-2 text-sm text-muted">This change is enforced and audited by the server. {pending.kind === "security" ? "It clears lockout state and invalidates existing sessions; it does not set a new password." : "A reason is required."}</p><form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}><label className="block text-sm"><span className="field-label">Reason</span><textarea className="input mt-1 min-h-24 resize-y" value={reason} onChange={(event) => setReason(event.target.value)} required minLength={1} maxLength={500} autoFocus /></label>{mutation.isError && <p className="text-sm text-[#d6336c]" role="alert">{errorText(mutation.error)}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn" disabled={mutation.isPending} onClick={() => setPending(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={mutation.isPending || !reason.trim()}>{mutation.isPending ? "Saving…" : "Confirm change"}</button></div></form></section></div>}
  </section>;
}

export default AdminPeopleManagement;
