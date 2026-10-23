"use client";

import { useState, type FormEvent } from "react";
import type { AdminReward } from "../types";
import { useAdminRewardCatalogue, useSaveAdminReward } from "../hooks";

type Draft = { name: string; description: string; kind: AdminReward["kind"]; cost: string; emoji: string; active: boolean };
const blankDraft: Draft = { name: "", description: "", kind: "redeem", cost: "0", emoji: "", active: true };
const cardClass = "rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5";

function fromReward(reward: AdminReward): Draft {
  return { name: reward.name, description: reward.description ?? "", kind: reward.kind, cost: String(reward.cost), emoji: reward.emoji ?? "", active: reward.active };
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "The catalogue could not be loaded.";
}

export type AdminRewardCatalogueManagerProps = { className?: string };

/** Standalone admin catalogue editor. API authorization and reason auditing are enforced server-side. */
export function AdminRewardCatalogueManager({ className = "" }: AdminRewardCatalogueManagerProps) {
  const catalogue = useAdminRewardCatalogue();
  const save = useSaveAdminReward();
  const [editing, setEditing] = useState<AdminReward | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");
  const [formOpen, setFormOpen] = useState(true);

  function startCreate() {
    save.reset(); setEditing(null); setDraft(blankDraft); setReason(""); setFormError(""); setSuccess(""); setFormOpen(true);
  }
  function startEdit(reward: AdminReward) {
    save.reset(); setEditing(reward); setDraft(fromReward(reward)); setReason(""); setFormError(""); setSuccess(""); setFormOpen(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError(""); setSuccess("");
    const cleanReason = reason.trim();
    const cost = Number(draft.cost);
    if (!cleanReason || cleanReason.length > 500) { setFormError("Enter an audit reason of up to 500 characters."); return; }
    if (!Number.isSafeInteger(cost) || cost < 0) { setFormError("Points must be a whole number greater than or equal to zero."); return; }
    try {
      await save.mutateAsync({ id: editing?.id, input: { name: draft.name.trim(), description: draft.description.trim() || null, kind: draft.kind, cost, emoji: draft.emoji.trim() || null, active: draft.active, reason: cleanReason } });
      setSuccess(editing ? "Reward updated and recorded in the audit log." : "Reward created and recorded in the audit log.");
      setEditing(null); setDraft(blankDraft); setReason("");
      setFormOpen(false);
    } catch (error) { setFormError(errorMessage(error)); }
  }

  if (catalogue.isPending) return <section className={`${cardClass} ${className}`} aria-busy="true"><p role="status" className="text-sm text-muted">Loading reward catalogue…</p></section>;
  if (catalogue.isError) return <section className={`${cardClass} ${className}`}><p role="alert" className="text-sm text-[#d6336c]">{errorMessage(catalogue.error)}</p><button type="button" className="btn mt-3" onClick={() => void catalogue.refetch()}>Try again</button></section>;

  const rewards = catalogue.data ?? [];
  return <section className={`space-y-5 ${className}`} aria-labelledby="admin-reward-catalogue-title">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="admin-reward-catalogue-title" className="text-xl font-medium">Reward catalogue</h2><p className="mt-1 text-sm text-muted">Create or update redeemable and earned rewards. Every change requires an audited reason.</p></div><button type="button" className="btn-primary" onClick={startCreate}>Add reward</button></header>
    {success && <p className="rounded-xl border border-teal/40 bg-teal/5 p-3 text-sm" role="status">{success}</p>}
    {rewards.length === 0 ? <div className={cardClass}><h3 className="font-medium">No rewards configured</h3><p className="mt-1 text-sm text-muted">Create the first reward to populate the catalogue.</p></div> : <ul className="grid gap-3 md:grid-cols-2">{rewards.map((reward) => <li key={reward.id} className={cardClass}><div className="flex items-start gap-3"><span aria-hidden="true" className="text-xl">{reward.emoji || "★"}</span><div className="min-w-0 flex-1"><h3 className="font-medium">{reward.name}</h3><p className="mt-1 text-sm text-muted">{reward.description || "No description"}</p><p className="mt-2 text-xs text-muted">{reward.kind === "redeem" ? "Redeemable" : "Earned"} · {reward.cost.toLocaleString()} points · <span className={reward.active ? "text-teal" : ""}>{reward.active ? "Active" : "Paused"}</span></p></div><button type="button" className="btn btn-small" onClick={() => startEdit(reward)}>Edit</button></div></li>)}</ul>}
    {formOpen && <form onSubmit={submit} className={`${cardClass} space-y-4`}>
      <div className="flex items-center justify-between gap-3"><h3 className="font-medium">{editing ? `Edit ${editing.name}` : "New reward"}</h3>{editing && <button type="button" className="btn btn-small" onClick={startCreate}>New reward instead</button>}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">Name<input className="input mt-1 w-full" required maxLength={160} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="block text-sm">Type<select className="input mt-1 w-full" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as AdminReward["kind"] })}><option value="redeem">Redeemable</option><option value="earned">Earned</option></select></label>
        <label className="block text-sm">Points<input className="input mt-1 w-full" type="number" min="0" max="100000000" step="1" required value={draft.cost} onChange={(event) => setDraft({ ...draft, cost: event.target.value })} /></label>
        <label className="block text-sm">Emoji or symbol<input className="input mt-1 w-full" maxLength={20} value={draft.emoji} onChange={(event) => setDraft({ ...draft, emoji: event.target.value })} /></label>
        <label className="block text-sm sm:col-span-2">Description<textarea className="input mt-1 min-h-20 w-full" maxLength={500} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Available in the catalogue</label>
      <label className="block text-sm">Audit reason<textarea className="input mt-1 min-h-20 w-full" required minLength={1} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this reward being created or changed?" /><span className="mt-1 block text-xs text-muted">Required for the privileged change; up to 500 characters.</span></label>
      {formError && <p className="text-sm text-[#d6336c]" role="alert">{formError}</p>}
      {save.isError && !formError && <p className="text-sm text-[#d6336c]" role="alert">{errorMessage(save.error)}</p>}
      <div className="flex flex-wrap gap-2"><button type="submit" className="btn-primary" disabled={save.isPending || !draft.name.trim() || !reason.trim()}>{save.isPending ? "Saving…" : editing ? "Save reward" : "Create reward"}</button><button type="button" className="btn" disabled={save.isPending} onClick={() => { setFormOpen(false); setEditing(null); setFormError(""); }}>Close</button></div>
    </form>}
  </section>;
}

export default AdminRewardCatalogueManager;
