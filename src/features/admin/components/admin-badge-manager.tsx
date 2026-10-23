"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui";
import {
  adminBadgeQueryKey,
  getAdminBadgeRules,
  saveAdminBadgeRule,
  type AdminBadge,
  type BadgeRuleChange,
} from "../badge-api";
import { AdminDrawer, AdminPagination } from "./admin-data-ui";

type BadgeDraft = {
  code: string;
  name: string;
  description: string;
  eventTypes: string[];
  minimumCount: string;
  active: boolean;
};

const blankDraft: BadgeDraft = { code: "", name: "", description: "", eventTypes: [], minimumCount: "1", active: true };

export function parseBadgeRuleForEditor(ruleJson: string): { eventTypes: string[]; minimumCount: number } | null {
  try {
    const parsed: unknown = JSON.parse(ruleJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const rule = parsed as { eventTypes?: unknown; eventType?: unknown; minimumCount?: unknown };
    const eventTypes = Array.isArray(rule.eventTypes) ? rule.eventTypes : typeof rule.eventType === "string" ? [rule.eventType] : [];
    if (!eventTypes.length || eventTypes.some((value) => typeof value !== "string" || !value) || !Number.isSafeInteger(rule.minimumCount) || Number(rule.minimumCount) < 1) return null;
    return { eventTypes: Array.from(new Set(eventTypes as string[])), minimumCount: Number(rule.minimumCount) };
  } catch {
    return null;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Badge rules could not be saved.";
}

function draftFromBadge(badge: AdminBadge): BadgeDraft {
  const rule = parseBadgeRuleForEditor(badge.ruleJson);
  return {
    code: badge.code,
    name: badge.name,
    description: badge.description,
    eventTypes: rule?.eventTypes ?? [],
    minimumCount: String(rule?.minimumCount ?? 1),
    active: badge.active,
  };
}

export function AdminBadgeManager() {
  const client = useQueryClient();
  const [cursors, setCursors] = useState<(number | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<AdminBadge | null>(null);
  const [draft, setDraft] = useState<BadgeDraft>(blankDraft);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const requestRef = useRef<{ signature: string; key: string } | null>(null);
  const page = useQuery({ queryKey: [...adminBadgeQueryKey, cursors[pageIndex]], queryFn: () => getAdminBadgeRules(cursors[pageIndex]) });
  const save = useMutation({ mutationFn: ({ id, input, key }: { id: number | null; input: BadgeRuleChange; key: string }) => saveAdminBadgeRule(id, input, key) });
  const availableEvents = page.data?.availableEvents ?? [];
  const configuredCodes = new Set(availableEvents.map((event) => event.code));
  const unknownEvents = draft.eventTypes.filter((code) => !configuredCodes.has(code));

  function startCreate() {
    setDrawerOpen(true);
    setSelected(null);
    setDraft(blankDraft);
    setReason("");
    setFormError("");
    setSuccess("");
    requestRef.current = null;
    save.reset();
  }

  function startEdit(badge: AdminBadge) {
    setDrawerOpen(true);
    setSelected(badge);
    setDraft(draftFromBadge(badge));
    setReason("");
    setFormError("");
    setSuccess("");
    requestRef.current = null;
    save.reset();
  }

  function toggleEvent(code: string) {
    setDraft((current) => ({ ...current, eventTypes: current.eventTypes.includes(code) ? current.eventTypes.filter((value) => value !== code) : [...current.eventTypes, code] }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minimumCount = Number(draft.minimumCount);
    const input: BadgeRuleChange = {
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      eventTypes: [...draft.eventTypes].sort(),
      minimumCount,
      active: draft.active,
      reason: reason.trim(),
    };
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.code) || input.code.length > 80 || !input.name || input.name.length > 160 || !input.description || input.description.length > 500 || input.eventTypes.length < 1 || input.eventTypes.length > 10 || unknownEvents.length > 0 || !Number.isSafeInteger(minimumCount) || minimumCount < 1 || minimumCount > 1_000_000 || !input.reason || input.reason.length > 500) {
      setFormError("Check the badge details, select configured event types, and provide an audited reason.");
      return;
    }
    setFormError("");
    setSuccess("");
    const signature = JSON.stringify({ id: selected?.id ?? null, input });
    if (requestRef.current?.signature !== signature) requestRef.current = { signature, key: crypto.randomUUID() };
    try {
      const saved = await save.mutateAsync({ id: selected?.id ?? null, input, key: requestRef.current.key });
      requestRef.current = null;
      setSelected(saved);
      setDraft(draftFromBadge(saved));
      setReason("");
      setSuccess(`Badge rule “${saved.name}” ${selected ? "updated" : "created"}.`);
      if (!selected) { setCursors([null]); setPageIndex(0); }
      await client.invalidateQueries({ queryKey: adminBadgeQueryKey });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <section className="app-card" aria-label="Badge rule management">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium">Badge rules</h2>
          <p className="mt-1 text-sm text-muted">Recognise milestones from configured points events. Every change records an audited reason.</p>
        </div>
        <Button variant="primary" onClick={startCreate} disabled={save.isPending}>Add badge</Button>
      </div>
      <input aria-label="Filter badge rules" className="input mt-4 max-w-sm" placeholder="Filter badge rules" value={filter} onChange={event => setFilter(event.target.value)} />
      {page.isPending ? (
        <p className="mt-5 rounded-xl border p-4 text-sm text-muted" style={{ borderColor: "var(--line)" }} role="status" aria-busy="true">Loading badge rules…</p>
      ) : page.isError ? (
        <div className="mt-5 rounded-xl border border-pink/40 p-4" role="alert">
          <p className="text-sm">Badge rules unavailable: {errorMessage(page.error)}</p>
          <Button className="mt-3" size="small" onClick={() => void page.refetch()}>Try again</Button>
        </div>
      ) : (
        <div className="mt-4">
          <div>
            {page.data.items.filter(badge => `${badge.code} ${badge.name} ${badge.description}`.toLowerCase().includes(filter.toLowerCase())).length === 0 ? (
              <p className="rounded-xl border p-4 text-sm text-muted" style={{ borderColor: "var(--line)" }}>No badge rules on this page. Add one to recognise a milestone.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--line)" }}><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-[var(--hover)] text-xs text-muted"><tr>{["#", "Badge", "Rule", "Status", "Action"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>
                {page.data.items.filter(badge => `${badge.code} ${badge.name} ${badge.description}`.toLowerCase().includes(filter.toLowerCase())).map((badge, index) => {
                  const rule = parseBadgeRuleForEditor(badge.ruleJson);
                  const needsRepair = !rule || rule.eventTypes.some((code) => !configuredCodes.has(code));
                  return <tr key={badge.id} className="border-t border-[var(--line)]"><td className="px-3 py-2">{pageIndex * 10 + index + 1}</td><td className="px-3 py-2"><b className="font-medium">{badge.name}</b><span className="block text-xs text-muted">{badge.code}</span></td><td className="px-3 py-2 text-xs text-muted">{rule ? `${rule.minimumCount} events · ${rule.eventTypes.join(", ")}` : "Invalid stored rule"}{needsRepair && <span className="block text-amber-700">Needs review</span>}</td><td className="px-3 py-2">{badge.active ? "Active" : "Paused"}</td><td className="px-3 py-2"><Button size="small" onClick={() => startEdit(badge)} disabled={save.isPending}>Details / edit</Button></td></tr>;
                })}
              </tbody></table></div>
            )}
            <AdminPagination label="Badge rules" page={pageIndex + 1} pageSize={10} total={(pageIndex + 1) * 10 + (page.data.nextAfter === null ? 0 : 1)} busy={save.isPending || page.isFetching} onPageChange={number => { if (number === pageIndex + 2 && page.data.nextAfter !== null) { const next = page.data.nextAfter; setCursors(current => [...current.slice(0, pageIndex + 1), next]); setPageIndex(number - 1); } else if (number === pageIndex) setPageIndex(number - 1); }} />
          </div>
          <AdminDrawer open={drawerOpen} onClose={() => !save.isPending && setDrawerOpen(false)} title={selected ? `Edit ${selected.name}` : "Create badge rule"} description="Every rule change records an audited reason." footer={<div className="flex gap-2"><Button variant="primary" type="submit" form="badge-rule-editor" disabled={save.isPending || availableEvents.length === 0}>{save.isPending ? "Saving…" : selected ? "Save badge rule" : "Create badge rule"}</Button>{selected && <Button disabled={save.isPending} onClick={() => { setDraft(draftFromBadge(selected)); setReason(""); setFormError(""); setSuccess(""); requestRef.current = null; }}>Discard edits</Button>}</div>}>
          <form id="badge-rule-editor" className="space-y-4" onSubmit={(event) => void submit(event)}>
            <h3 className="font-medium">{selected ? `Edit ${selected.name}` : "New badge"}</h3>
            <fieldset className="space-y-4" disabled={save.isPending}>
              <label className="block text-sm"><span className="field-label">Code</span><input className="input mt-1" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} /><span className="mt-1 block text-xs text-muted">Lowercase letters, numbers, and hyphens.</span></label>
              <label className="block text-sm"><span className="field-label">Name</span><input className="input mt-1" required maxLength={160} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label className="block text-sm"><span className="field-label">Description</span><textarea className="input mt-1 min-h-20 resize-y" required maxLength={500} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              <div>
                <span className="field-label">Qualifying points events</span>
                <div className="mt-2 grid gap-2 rounded-xl border p-3 sm:grid-cols-2" style={{ borderColor: "var(--line)" }}>
                  {availableEvents.length === 0 ? <p className="text-sm text-muted">No points events are configured.</p> : availableEvents.map((badgeEvent) => <label key={badgeEvent.code} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={draft.eventTypes.includes(badgeEvent.code)} onChange={() => toggleEvent(badgeEvent.code)} /><span>{badgeEvent.name}<span className="block text-xs text-muted">{badgeEvent.code}{badgeEvent.active ? "" : " · points rule paused"}</span></span></label>)}
                </div>
                {unknownEvents.length > 0 && <div className="mt-2 rounded-xl border border-[#b45309]/40 p-3 text-sm" role="alert"><p>These stored event codes are no longer configured: {unknownEvents.join(", ")}. Remove them and select a configured event before saving.</p>{unknownEvents.map((code) => <Button key={code} size="small" className="mr-2 mt-2" onClick={() => toggleEvent(code)}>Remove {code}</Button>)}</div>}
              </div>
              <label className="block text-sm"><span className="field-label">Minimum events</span><input className="input mt-1 max-w-40" type="number" min="1" max="1000000" step="1" required value={draft.minimumCount} onChange={(event) => setDraft({ ...draft, minimumCount: event.target.value })} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Active badge rule</label>
              <label className="block text-sm"><span className="field-label">Audited reason</span><textarea className="input mt-1 min-h-24 resize-y" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this badge rule is being changed." /></label>
            </fieldset>
            {formError && <p className="text-sm text-[#d6336c]" role="alert">Save failed: {formError}</p>}
            {success && <p className="text-sm text-teal" role="status">{success}</p>}
          </form></AdminDrawer>
        </div>
      )}
    </section>
  );
}

export default AdminBadgeManager;
