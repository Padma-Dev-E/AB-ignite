"use client";

import { useState, type FormEvent } from "react";
import { Button } from "../../../components/ui";
import { useAdminRewards, useCreateAdminReward, useUpdateAdminReward } from "../hooks";
import type { AdminReward } from "../types";

export type AdminRewardCatalogueManagerProps = { className?: string };

type Draft = { name: string; description: string; kind: AdminReward["kind"]; cost: string; emoji: string; active: boolean };
const blank: Draft = { name: "", description: "", kind: "redeem", cost: "0", emoji: "", active: true };

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "The reward catalogue could not be saved."; }
function draftFromReward(reward: AdminReward): Draft { return { name: reward.name, description: reward.description ?? "", kind: reward.kind, cost: String(reward.cost), emoji: reward.emoji ?? "", active: reward.active }; }

/** Standalone administrator CRUD surface for the audited reward catalogue API. */
export function AdminRewardCatalogueManager({ className = "" }: AdminRewardCatalogueManagerProps) {
  const catalogue = useAdminRewards();
  const create = useCreateAdminReward();
  const update = useUpdateAdminReward();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const saving = create.isPending || update.isPending;
  const selected = catalogue.data?.find((reward) => reward.id === selectedId) ?? null;

  function startCreate() { setSelectedId(null); setDraft(blank); setReason(""); setFormError(""); setSuccess(""); create.reset(); update.reset(); }
  function startEdit(reward: AdminReward) { setSelectedId(reward.id); setDraft(draftFromReward(reward)); setReason(""); setFormError(""); setSuccess(""); create.reset(); update.reset(); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanReason = reason.trim();
    const cost = Number(draft.cost);
    if (!cleanReason || cleanReason.length > 500 || !Number.isSafeInteger(cost) || cost < 0) return;
    setFormError(""); setSuccess("");
    const input = { name: draft.name.trim(), description: draft.description.trim() || null, kind: draft.kind, cost, emoji: draft.emoji.trim() || null, active: draft.active, reason: cleanReason };
    try {
      if (selectedId === null) {
        const result = await create.mutateAsync(input);
        setSelectedId(result.reward.id);
        setSuccess(`Created “${result.reward.name}”.`);
      } else {
        const result = await update.mutateAsync({ id: selectedId, input });
        setSuccess(`Saved “${result.reward.name}”.`);
      }
      setReason("");
    } catch (error) { setFormError(errorMessage(error)); }
  }

  return <section className={`app-card ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-medium">Reward catalogue</h2><p className="mt-1 text-sm text-muted">Create rewards or publish a new audited version. Pause a reward to remove it from the employee catalogue.</p></div><Button variant="primary" onClick={startCreate}>Add reward</Button></div>
    {catalogue.isPending ? <p className="mt-5 rounded-xl border p-4 text-sm text-muted" style={{ borderColor: "var(--line)" }} role="status" aria-busy="true">Loading reward catalogue…</p> : catalogue.isError ? <div className="mt-5 rounded-xl border border-pink/40 p-4" role="alert"><p className="text-sm">Catalogue unavailable: {errorMessage(catalogue.error)}</p><Button className="mt-3" size="small" onClick={() => void catalogue.refetch()}>Try again</Button></div> : <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(240px,.8fr)_minmax(0,1.2fr)]">
      <div>
        {!catalogue.data?.length ? <div className="rounded-xl border p-4 text-sm text-muted" style={{ borderColor: "var(--line)" }}>No rewards exist yet. Add the first catalogue item.</div> : <ul className="space-y-2">{catalogue.data.map((reward) => <li key={reward.id}><button type="button" onClick={() => startEdit(reward)} aria-pressed={selectedId === reward.id} className={`w-full rounded-xl border p-3 text-left ${selectedId === reward.id ? "border-blue bg-blue/5" : ""}`} style={{ borderColor: selectedId === reward.id ? undefined : "var(--line)" }}><span className="flex items-center justify-between gap-2"><b className="font-medium">{reward.emoji ? `${reward.emoji} ` : ""}{reward.name}</b><span className={`text-xs ${reward.active ? "text-teal" : "text-muted"}`}>{reward.active ? "Active" : "Paused"}</span></span><span className="mt-1 block text-xs text-muted">{reward.kind === "redeem" ? `Redeem · ${reward.cost} pts` : "Recognition · earned"}</span></button></li>)}</ul>}
      </div>
      <form className="space-y-4 rounded-xl border p-4" style={{ borderColor: "var(--line)" }} onSubmit={(event) => void submit(event)}>
        <div><h3 className="font-medium">{selected ? `Edit ${selected.name}` : "New reward"}</h3><p className="mt-1 text-xs text-muted">Every change requires a reason and creates an audit event and version.</p></div>
        <label className="block text-sm"><span className="field-label">Name</span><input className="input mt-1" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={160} /></label>
        <label className="block text-sm"><span className="field-label">Description</span><textarea className="input mt-1 min-h-20 resize-y" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={500} /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm"><span className="field-label">Reward type</span><select className="input mt-1" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as AdminReward["kind"] })}><option value="redeem">Redeem with points</option><option value="earned">Earned recognition</option></select></label><label className="block text-sm"><span className="field-label">Point cost</span><input className="input mt-1" type="number" min="0" max="100000000" step="1" required disabled={draft.kind === "earned"} value={draft.cost} onChange={(event) => setDraft({ ...draft, cost: event.target.value })} /></label></div>
        <label className="block text-sm"><span className="field-label">Emoji (optional)</span><input className="input mt-1 max-w-40" value={draft.emoji} onChange={(event) => setDraft({ ...draft, emoji: event.target.value })} maxLength={20} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Available in employee catalogue</label>
        <label className="block text-sm"><span className="field-label">Audited reason</span><textarea className="input mt-1 min-h-24 resize-y" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={500} placeholder="Explain why this catalogue change is required." /><span className="mt-1 block text-xs text-muted">Required for every create or update, up to 500 characters.</span></label>
        {formError && <p className="text-sm text-[#d6336c]" role="alert">Save failed: {formError}</p>}{success && <p className="text-sm text-[#0e9f7a]" role="status">{success}</p>}
        <div className="flex flex-wrap gap-2"><Button variant="primary" type="submit" disabled={saving || !draft.name.trim() || !reason.trim() || reason.trim().length > 500 || !Number.isSafeInteger(Number(draft.cost)) || Number(draft.cost) < 0}>{saving ? "Saving…" : selectedId === null ? "Create reward" : "Save version"}</Button>{selected && <Button disabled={saving} onClick={() => { setDraft(draftFromReward(selected)); setReason(""); setFormError(""); setSuccess(""); }}>Discard edits</Button>}</div>
      </form>
    </div>}
  </section>;
}

export default AdminRewardCatalogueManager;
