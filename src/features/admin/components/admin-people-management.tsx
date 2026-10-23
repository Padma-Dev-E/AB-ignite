"use client";

import React, { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../lib/api/client";
import type { AdminUser } from "../types";
import { peopleQueryKeys, type AdminUserSession } from "../people-api";
import { useCreatePerson, usePeopleUsers, useResetPersonPassword, useResetPersonSignInSecurity, useRevokePersonSession, useUpdatePersonActivation, useUpdatePersonRole } from "../people-hooks";
import { useAdminSettings } from "../hooks";
import { PeoplePagination } from "./people-pagination";
import { AdminDrawer } from "./admin-data-ui";

type Operation = { user: AdminUser; kind: "role" | "activation" | "security" | "password"; value?: AdminUser["role"] | boolean };

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function PersonSessions({ userId }: { userId: number }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<AdminUserSession | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const sessions = useInfiniteQuery({
    queryKey: peopleQueryKeys.sessions(userId),
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "10" });
      if (pageParam !== null) params.set("after", String(pageParam));
      return apiFetch<{ items: AdminUserSession[]; nextAfter: number | null }>(`/api/admin/users/${userId}/sessions?${params}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextAfter ?? undefined,
  });
  const revoke = useRevokePersonSession();
  const pages = sessions.data?.pages ?? [];
  const currentPage = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const items = pages[currentPage]?.items.slice(0, 10) ?? [];
  const hasNext = currentPage < pages.length - 1 || !!sessions.hasNextPage;

  async function nextPage() {
    if (currentPage < pages.length - 1) { setPageIndex(currentPage + 1); return; }
    if (!sessions.hasNextPage || sessions.isFetchingNextPage) return;
    const result = await sessions.fetchNextPage();
    if (result.data && result.data.pages.length > currentPage + 1) setPageIndex(currentPage + 1);
  }

  async function confirmRevoke(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reason.trim()) return;
    try {
      await revoke.mutateAsync({ userId, sessionId: selected.id, reason: reason.trim() });
      setNotice("Session revoked."); setSelected(null); setReason("");
    } catch { /* The dialog displays the mutation error. */ }
  }

  if (sessions.isPending) return <p className="p-4 text-sm text-muted" role="status">Loading sessions…</p>;
  if (sessions.isError && !sessions.data) return <div className="p-4" role="alert"><p className="text-sm text-[#d6336c]">Sessions could not be loaded: {errorText(sessions.error)}</p><button type="button" className="btn btn-small mt-2" onClick={() => void sessions.refetch()}>Retry</button></div>;
  return <div className="min-w-0">
    {notice && <p className="px-4 pt-3 text-sm text-teal" role="status">{notice}</p>}
    {sessions.isRefetchError && !sessions.isFetchNextPageError && <p className="px-4 pt-3 text-sm text-[#d6336c]" role="alert">Sessions could not be refreshed: {errorText(sessions.error)}. <button type="button" className="underline" onClick={() => void sessions.refetch()}>Retry</button></p>}
    {items.length === 0 ? <p className="p-4 text-sm text-muted">No sessions recorded.</p> : <div className="max-w-full overflow-x-auto"><div className="min-w-[650px] divide-y" style={{ borderColor: "var(--line)" }}>{items.map((session) => <article key={session.id} className="flex items-center gap-4 px-4 py-3 text-sm"><span className={`pill shrink-0 ${session.isActive ? "text-teal" : "text-muted"}`}>{session.isActive ? "Active" : session.revokedAt ? "Revoked" : "Expired"}</span><div className="min-w-0 flex-1"><p>Started {formatDate(session.createdAt)}</p><p className="text-xs text-muted">Last seen {formatDate(session.lastSeenAt)} · Expires {formatDate(session.expiresAt)}</p>{session.revocationReason && <p className="break-words text-xs text-muted">{session.revocationReason}</p>}</div>{session.isActive && <button type="button" className="btn btn-small shrink-0" disabled={revoke.isPending} onClick={() => { revoke.reset(); setReason(""); setNotice(""); setSelected(session); }}>Revoke</button>}</article>)}</div></div>}
    <div className="px-4 pb-3"><PeoplePagination label="Sessions" page={currentPage + 1} loadedPages={pages.length} hasNext={hasNext} busy={sessions.isFetchingNextPage} onPageChange={(page) => { if (page - 1 < pages.length) setPageIndex(page - 1); else void nextPage(); }} /></div>
    {sessions.isFetchNextPageError && <p className="px-4 pb-3 text-sm text-[#d6336c]" role="alert">Could not load the next sessions page: {errorText(sessions.error)}. Select Next to retry.</p>}
    <Dialog open={selected !== null} onClose={() => { if (!revoke.isPending) setSelected(null); }} className="relative z-50"><div className="fixed inset-0 bg-black/40" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4"><DialogPanel className="w-full max-w-lg rounded-2xl border bg-[var(--card)] p-5 shadow-xl" style={{ borderColor: "var(--line)" }}><DialogTitle className="text-lg font-medium">Revoke session</DialogTitle><p className="mt-2 text-sm text-muted">This signs out the selected session. The reason is recorded in the audit log.</p><form className="mt-4 space-y-3" onSubmit={(event) => void confirmRevoke(event)}><label className="block text-sm"><span className="field-label">Reason</span><textarea className="input mt-1 min-h-24 w-full resize-y" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>{revoke.isError && <p className="text-sm text-[#d6336c]" role="alert">{errorText(revoke.error)}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn" disabled={revoke.isPending} onClick={() => setSelected(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={revoke.isPending || !reason.trim()}>{revoke.isPending ? "Revoking…" : "Revoke session"}</button></div></form></DialogPanel></div></Dialog>
  </div>;
}

export type AdminPeopleManagementProps = { className?: string; currentUserId?: number };

export type TemporaryPasswordNoticeProps = {
  email: string;
  password: string;
  onDismiss: () => void;
};

/** Displays a generated credential once, with the first sign-in requirement made explicit. */
export function TemporaryPasswordNotice({ email, password, onDismiss }: TemporaryPasswordNoticeProps) {
  return <div className="mb-4 rounded-xl border border-teal/40 bg-teal/5 p-3 text-sm" role="status" aria-live="polite">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <p className="font-medium">Temporary password for {email}</p>
      <button type="button" className="btn btn-small" onClick={onDismiss} aria-label="Dismiss temporary password">Dismiss password</button>
    </div>
    <code className="mt-2 block break-all select-all rounded border p-2" style={{ borderColor: "var(--line)" }}>{password}</code>
    <p className="mt-2 text-muted">Copy it now and deliver it through an approved bank channel. The mustChangePassword requirement applies to every role: the user must change this password at first sign-in before accessing the app. The password is shown once and will not be available after dismissal.</p>
  </div>;
}

/** Standalone people controls. Role/activation/security writes require a reason and are audited server-side. */
export function AdminPeopleManagement({ className = "", currentUserId }: AdminPeopleManagementProps) {
  const settings = useAdminSettings();
  const [search, setSearch] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setServerSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const people = usePeopleUsers(serverSearch);
  const roleMutation = useUpdatePersonRole();
  const activationMutation = useUpdatePersonActivation();
  const securityMutation = useResetPersonSignInSecurity();
  const passwordMutation = useResetPersonPassword();
  const createMutation = useCreatePerson();
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pending, setPending] = useState<Operation | null>(null);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState("");
  const [oneTimePassword, setOneTimePassword] = useState<{ email: string; value: string } | null>(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", department: "", jobTitle: "", role: "employee" as AdminUser["role"], reason: "" });
  const mutation = pending?.kind === "role" ? roleMutation : pending?.kind === "activation" ? activationMutation : pending?.kind === "password" ? passwordMutation : securityMutation;
  const pages = people.data?.pages ?? [];
  const currentPage = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const peopleRows = pages[currentPage]?.items.slice(0, 10) ?? [];
  const filteredRows = peopleRows.filter((user) => (roleFilter === "all" || user.role === roleFilter) && (statusFilter === "all" || (statusFilter === "active") === user.isActive));
  const hasNext = currentPage < pages.length - 1 || !!people.hasNextPage;
  const searching = search.trim() !== serverSearch;
  const allRoles: AdminUser["role"][] = ["employee", "back_office", "business_owner"];
  function policyList(key: "roles" | "departments"): string[] {
    const raw = settings.data?.priority[key];
    if (!raw) return [];
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) && parsed.every(item => typeof item === "string") ? parsed : []; }
    catch { return []; }
  }
  const configuredRoles = policyList("roles") as AdminUser["role"][];
  const availableRoles = configuredRoles.length ? allRoles.filter(role => configuredRoles.includes(role)) : allRoles;
  const availableDepartments = policyList("departments");
  const selectedNewRole = availableRoles.includes(newUser.role) ? newUser.role : availableRoles[0];

  async function nextPage() {
    if (currentPage < pages.length - 1) { setPageIndex(currentPage + 1); return; }
    if (!people.hasNextPage || people.isFetchingNextPage) return;
    const result = await people.fetchNextPage();
    if (result.data && result.data.pages.length > currentPage + 1) setPageIndex(currentPage + 1);
  }

  function prepare(operation: Operation) {
    roleMutation.reset(); activationMutation.reset(); securityMutation.reset(); passwordMutation.reset();
    setReason(""); setSuccess(""); setOneTimePassword(null); setPending(operation);
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(""); setOneTimePassword(null);
    try {
      const result = await createMutation.mutateAsync({ ...newUser, role: selectedNewRole, name: newUser.name.trim(), email: newUser.email.trim(), department: newUser.department.trim(), jobTitle: newUser.jobTitle.trim(), reason: newUser.reason.trim() });
      setSuccess(`Created ${result.user.email}. Deliver the temporary password through an approved bank channel.`);
      setOneTimePassword({ email: result.user.email, value: result.temporaryPassword });
      createMutation.reset();
      setNewUser({ name: "", email: "", department: "", jobTitle: "", role: "employee", reason: "" });
      setPageIndex(0); setSelectedUser(null); setCreateOpen(false);
    } catch { /* Creation error is rendered below the form. */ }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending || !reason.trim()) return;
    setSuccess("");
    try {
      if (pending.kind === "role") {
        await roleMutation.mutateAsync({ userId: pending.user.id, role: pending.value as AdminUser["role"], reason: reason.trim() });
        setSelectedUser(current => current?.id === pending.user.id ? { ...current, role: pending.value as AdminUser["role"] } : current);
      }
      else if (pending.kind === "activation") {
        await activationMutation.mutateAsync({ userId: pending.user.id, active: pending.value as boolean, reason: reason.trim() });
        setSelectedUser(current => current?.id === pending.user.id ? { ...current, isActive: pending.value as boolean, deactivatedAt: pending.value ? null : new Date().toISOString() } : current);
      }
      else if (pending.kind === "password") { const result = await passwordMutation.mutateAsync({ userId: pending.user.id, reason: reason.trim() }); setOneTimePassword({ email: pending.user.email, value: result.temporaryPassword }); passwordMutation.reset(); setSuccess(`${pending.user.name}: password reset. Deliver the temporary password through an approved bank channel.`); }
      else await securityMutation.mutateAsync({ userId: pending.user.id, reason: reason.trim() });
      if (pending.kind !== "password") setSuccess(`${pending.user.name}: ${pending.kind === "security" ? "sign-in security reset" : pending.kind === "role" ? `role changed to ${pending.value}` : pending.value ? "account activated" : "account deactivated"}.`);
      setPending(null);
      setReason("");
    } catch { /* Mutation error is rendered in the confirmation form. */ }
  }

  const title = pending?.kind === "role" ? `Change ${pending.user.name}'s role` : pending?.kind === "activation" ? `${pending.value ? "Activate" : "Deactivate"} ${pending.user.name}` : pending?.kind === "password" ? `Reset password for ${pending.user.name}` : `Reset sign-in security for ${pending?.user.name ?? "user"}`;

  return <section className={`app-card min-w-0 ${className}`}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-medium">People & access</h2><p className="mt-1 text-sm text-muted">Manage account roles, access state, sign-in recovery and review session activity.</p></div><div className="flex w-full flex-wrap gap-3 sm:w-auto sm:items-end"><label className="min-w-0 flex-1 sm:w-64"><span className="field-label">Search people</span><input className="input mt-1 w-full" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPageIndex(0); }} placeholder="Name, email or department" /></label><button type="button" className="btn-primary" disabled={settings.isPending || settings.isError || availableRoles.length === 0} onClick={() => { createMutation.reset(); setCreateOpen(true); }}>Create user</button></div></div>
    <AdminDrawer open={createOpen} onClose={() => !createMutation.isPending && setCreateOpen(false)} title="Create user" description="Create an account with a temporary password and required first sign-in password change." footer={<div className="flex justify-end gap-2"><button type="button" className="btn" disabled={createMutation.isPending} onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" form="create-admin-user" className="btn-primary" disabled={createMutation.isPending || settings.isPending || settings.isError || availableRoles.length === 0 || !newUser.name.trim() || !newUser.department.trim() || !newUser.reason.trim()}>{createMutation.isPending ? "Creating…" : "Create user"}</button></div>}>
      <form id="create-admin-user" className="space-y-4" onSubmit={(event) => void createUser(event)}><label className="block text-sm"><span className="field-label">Name</span><input className="input mt-1 w-full" required maxLength={120} value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} /></label><label className="block text-sm"><span className="field-label">Email</span><input className="input mt-1 w-full" required maxLength={254} type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} /></label><label className="block text-sm"><span className="field-label">Department</span>{availableDepartments.length ? <select className="input mt-1 w-full" required value={newUser.department} onChange={(event) => setNewUser({ ...newUser, department: event.target.value })}><option value="">Choose a department</option>{availableDepartments.map(department => <option key={department} value={department}>{department}</option>)}</select> : <input className="input mt-1 w-full" required maxLength={120} value={newUser.department} onChange={(event) => setNewUser({ ...newUser, department: event.target.value })} />}</label><label className="block text-sm"><span className="field-label">Job title (optional)</span><input className="input mt-1 w-full" maxLength={120} value={newUser.jobTitle} onChange={(event) => setNewUser({ ...newUser, jobTitle: event.target.value })} /></label><label className="block text-sm"><span className="field-label">Role</span><select className="input mt-1 w-full" disabled={availableRoles.length === 0} value={selectedNewRole} onChange={(event) => setNewUser({ ...newUser, role: event.target.value as AdminUser["role"] })}>{availableRoles.map(role => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></label>{availableRoles.length === 0 && <p className="text-sm text-[#d6336c]" role="alert">No user roles are allowed by the current access policy. Update the role policy before creating a user.</p>}<label className="block text-sm"><span className="field-label">Audited reason</span><textarea className="input mt-1 w-full" required maxLength={500} value={newUser.reason} onChange={(event) => setNewUser({ ...newUser, reason: event.target.value })} /></label>{createMutation.isError && <p className="text-sm text-[#d6336c]" role="alert">{errorText(createMutation.error)}</p>}</form>
    </AdminDrawer>
    <div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="text-sm"><span className="field-label">Filter by role</span><select className="input mt-1 w-full" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPageIndex(0); }}><option value="all">All roles</option>{allRoles.map(role => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></label><label className="text-sm"><span className="field-label">Filter by status</span><select className="input mt-1 w-full" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPageIndex(0); }}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Deactivated</option></select></label></div>
    {settings.isError && <p className="mb-4 text-sm text-[#d6336c]" role="alert">Access policy could not be loaded. User creation and role changes are paused. <button type="button" className="underline" onClick={() => void settings.refetch()}>Retry</button></p>}
    {success && <p className="mb-4 rounded-xl border border-teal/40 bg-teal/5 p-3 text-sm" role="status">{success}</p>}
    {oneTimePassword && <TemporaryPasswordNotice email={oneTimePassword.email} password={oneTimePassword.value} onDismiss={() => setOneTimePassword(null)} />}
    {searching || people.isPending ? <div className="py-10 text-center text-sm text-muted" role="status" aria-busy="true">{searching ? "Searching people…" : "Loading people…"}</div> : people.isError && !people.data ? <div className="rounded-xl border border-pink/40 p-4" role="alert"><p className="text-sm">People could not be loaded: {errorText(people.error)}</p><button type="button" className="btn btn-small mt-3" onClick={() => void people.refetch()}>Retry</button></div> : <>
      {people.isRefetchError && !people.isFetchNextPageError && <p className="mb-3 text-sm text-[#d6336c]" role="alert">People could not be refreshed: {errorText(people.error)}. <button type="button" className="underline" onClick={() => void people.refetch()}>Retry</button></p>}
      {filteredRows.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted" style={{ borderColor: "var(--line)" }}>{peopleRows.length ? "No users match these filters on this page." : serverSearch ? "No people match this search." : "No users found."}</p> : <div className="max-w-full overflow-x-auto rounded-xl border" style={{ borderColor: "var(--line)" }}><table className="w-full min-w-[850px] border-collapse text-left text-sm"><thead className="bg-[var(--hover)] text-xs uppercase tracking-wide text-muted"><tr>{["User", "Department", "Role", "Status", "Last activity", ""].map((heading, index) => <th key={heading || index} scope="col" className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y" style={{ borderColor: "var(--line)" }}>{filteredRows.map(user => <tr key={user.id} className="hover:bg-[var(--hover)]"><td className="px-4 py-3"><p className="font-medium">{user.name}</p><p className="mt-0.5 break-all text-xs text-muted">{user.email}</p></td><td className="px-4 py-3">{user.department || "—"}</td><td className="px-4 py-3"><span className="pill">{user.role.replaceAll("_", " ")}</span></td><td className="px-4 py-3"><span className={`pill ${user.isActive ? "text-teal" : "text-pink"}`}>{user.isActive ? "Active" : "Deactivated"}</span></td><td className="px-4 py-3">{formatDate(user.lastSeenAt)}</td><td className="px-4 py-3 text-right"><button type="button" className="btn btn-small" onClick={() => setSelectedUser(user)}>View details</button></td></tr>)}</tbody></table></div>}
      <PeoplePagination label="People" page={currentPage + 1} loadedPages={pages.length} hasNext={hasNext} busy={people.isFetchingNextPage} onPageChange={(page) => { const target = page - 1; if (target < pages.length) setPageIndex(target); else void nextPage(); }} />
      {people.isFetchNextPageError && <p className="mt-2 text-sm text-[#d6336c]" role="alert">Could not load the next people page: {errorText(people.error)}. Select the next page to retry.</p>}
    </>}
    <AdminDrawer open={selectedUser !== null} onClose={() => { if (!mutation.isPending) setSelectedUser(null); }} title={selectedUser?.name ?? "User details"} description={selectedUser?.email} footer={selectedUser && <div className="flex flex-wrap gap-2"><button type="button" className="btn" disabled={selectedUser.id === currentUserId || activationMutation.isPending} onClick={() => prepare({ user: selectedUser, kind: "activation", value: !selectedUser.isActive })}>{selectedUser.isActive ? "Deactivate" : "Activate"}</button><button type="button" className="btn" disabled={selectedUser.id === currentUserId || securityMutation.isPending} onClick={() => prepare({ user: selectedUser, kind: "security" })}>Reset sign-in</button><button type="button" className="btn" disabled={selectedUser.id === currentUserId || passwordMutation.isPending} onClick={() => prepare({ user: selectedUser, kind: "password" })}>Reset password</button></div>}>
      {selectedUser && <div className="space-y-6"><section><h3 className="font-semibold">Profile</h3><dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{[["Name", selectedUser.name], ["Email", selectedUser.email], ["Department", selectedUser.department || "—"], ["Job title", selectedUser.jobTitle || "—"], ["Account status", selectedUser.isActive ? "Active" : "Deactivated"], ["Created", formatDate(selectedUser.createdAt)], ["Last sign-in", formatDate(selectedUser.lastLoginAt)], ["Last activity", formatDate(selectedUser.lastSeenAt)], ["Locked until", selectedUser.lockedUntil ? formatDate(selectedUser.lockedUntil) : "Not locked"], ["Failed sign-in attempts", String(selectedUser.failedLoginAttempts)]].map(([label, value]) => <div key={label} className="rounded-lg border p-3" style={{ borderColor: "var(--line)" }}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>)}</dl></section><section><h3 className="font-semibold">Role</h3><label className="mt-2 block max-w-sm text-sm"><span className="field-label">Change role</span><select className="input mt-1 w-full" value={selectedUser.role} disabled={selectedUser.id === currentUserId || roleMutation.isPending || settings.isPending || settings.isError} onChange={(event) => prepare({ user: selectedUser, kind: "role", value: event.target.value as AdminUser["role"] })}>{(availableRoles.includes(selectedUser.role) ? availableRoles : [selectedUser.role, ...availableRoles]).map(role => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></label>{selectedUser.id === currentUserId && <p className="mt-2 text-xs text-muted">Your own account cannot be changed here.</p>}</section><section><h3 className="font-semibold">Sessions</h3><p className="mt-1 text-sm text-muted">Session tokens are never displayed. Active sessions can be revoked with an audited reason.</p><div className="mt-3 rounded-xl border" style={{ borderColor: "var(--line)" }}><PersonSessions userId={selectedUser.id} /></div></section></div>}
    </AdminDrawer>

    <Dialog open={pending !== null} onClose={() => { if (!mutation.isPending) setPending(null); }} className="relative z-50"><div className="fixed inset-0 bg-black/40" aria-hidden="true" /><div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4"><DialogPanel className="w-full max-w-lg rounded-2xl border bg-[var(--card)] p-5 shadow-xl" style={{ borderColor: "var(--line)" }}><DialogTitle className="text-lg font-medium">{title}</DialogTitle><p className="mt-2 text-sm text-muted">This change is enforced and audited by the server. {pending?.kind === "security" ? "It clears lockout state and invalidates existing sessions; it does not set a new password." : "A reason is required."}</p><form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}><label className="block text-sm"><span className="field-label">Reason</span><textarea className="input mt-1 min-h-24 w-full resize-y" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={500} /></label>{mutation.isError && <p className="text-sm text-[#d6336c]" role="alert">{errorText(mutation.error)}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn" disabled={mutation.isPending} onClick={() => setPending(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={mutation.isPending || !reason.trim()}>{mutation.isPending ? "Saving…" : "Confirm change"}</button></div></form></DialogPanel></div></Dialog>
  </section>;
}

export default AdminPeopleManagement;
