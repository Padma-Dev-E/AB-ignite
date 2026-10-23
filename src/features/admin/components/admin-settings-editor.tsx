"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../lib/api/client";
import { Button } from "../../../components/ui";
import { useAdminSettings } from "../hooks";
import { adminQueryKeys } from "../api";

export type AdminSettingsEditorProps = {
  className?: string;
};

type PointRule = { code: string; points: number; active: boolean };
type LevelRule = { id: number; name: string; description: string | null; minimumPoints: number; sortOrder: number };

function message(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Settings could not be saved.";
}

export function AdminSettingsEditor({ className = "" }: AdminSettingsEditorProps) {
  const settings = useAdminSettings();
  const client = useQueryClient();
  const [pointRules, setPointRules] = useState<PointRule[] | null>(null);
  const [levels, setLevels] = useState<LevelRule[] | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (settings.isPending) return <section className={`app-card ${className}`} aria-busy="true"><p className="text-sm text-muted" role="status">Loading admin settings…</p></section>;
  if (settings.isError || !settings.data) return <section className={`app-card ${className}`}><p className="text-sm text-[#d6336c]" role="alert">{settings.error instanceof Error ? settings.error.message : "Admin settings could not be loaded."}</p><button type="button" className="btn mt-3" onClick={() => void settings.refetch()}>Try again</button></section>;

  const points = pointRules ?? settings.data.pointRules.map(({ code, points: value, active }) => ({ code, points: value, active }));
  const configuredLevels = levels ?? settings.data.levels;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (!normalizedReason || normalizedReason.length > 500) { setError("Enter a privileged reason of up to 500 characters."); return; }
    if (!pointRules && !levels) { setError("Change at least one setting before saving."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await apiFetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: normalizedReason, ...(pointRules ? { pointRules } : {}), ...(levels ? { levels } : {}) }) });
      await client.invalidateQueries({ queryKey: adminQueryKeys.settings });
      setPointRules(null); setLevels(null); setReason(""); setSuccess("Settings saved and audited.");
    } catch (cause) { setError(message(cause)); }
    finally { setSaving(false); }
  }

  return <section className={`app-card ${className}`}>
    <h2 className="text-2xl font-medium">Workflow settings</h2>
    <p className="mt-1 text-sm text-muted">Points and level changes are recorded in the audit trail.</p>
    {success && <p className="mt-4 rounded-xl border border-teal/40 bg-teal/5 p-3 text-sm" role="status">{success}</p>}
    {error && <p className="mt-4 rounded-xl border border-pink/40 bg-pink/5 p-3 text-sm text-[#d6336c]" role="alert">{error}</p>}
    <form className="mt-5 space-y-5" onSubmit={submit} aria-busy={saving}>
      <fieldset disabled={saving} className="space-y-5">
        <div><h3 className="font-medium">Ignite levels</h3>{configuredLevels.length ? <div className="mt-2 space-y-2">{configuredLevels.map((level, index) => <div key={level.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-4" style={{ borderColor: "var(--line)" }}><label className="text-sm">Level name<input className="input mt-1 w-full" maxLength={120} value={level.name} onChange={(event) => setLevels(configuredLevels.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label><label className="text-sm">Minimum points<input className="input mt-1 w-full" type="number" min="0" max="10000000" value={level.minimumPoints} onChange={(event) => setLevels(configuredLevels.map((item, i) => i === index ? { ...item, minimumPoints: Number(event.target.value) } : item))} /></label><label className="text-sm">Sort order<input className="input mt-1 w-full" type="number" min="0" max="100" value={level.sortOrder} onChange={(event) => setLevels(configuredLevels.map((item, i) => i === index ? { ...item, sortOrder: Number(event.target.value) } : item))} /></label><label className="text-sm">Description<input className="input mt-1 w-full" maxLength={500} value={level.description ?? ""} onChange={(event) => setLevels(configuredLevels.map((item, i) => i === index ? { ...item, description: event.target.value || null } : item))} /></label></div>)}</div> : <p className="mt-2 text-sm text-muted">No levels are configured yet.</p>}</div>
        <div><h3 className="font-medium">Point rules</h3><div className="mt-2 divide-y" style={{ borderColor: "var(--line)" }}>{points.map((rule, index) => <div key={rule.code} className="flex flex-wrap items-center gap-3 py-2"><span className="min-w-32 flex-1 text-sm">{settings.data.pointRules[index]?.name ?? rule.code}</span><label className="text-sm">Points <input className="input ml-1 w-24" type="number" min="0" max="100000" step="1" value={rule.points} onChange={(event) => setPointRules(points.map((item, i) => i === index ? { ...item, points: Number(event.target.value) } : item))} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.active} onChange={(event) => setPointRules(points.map((item, i) => i === index ? { ...item, active: event.target.checked } : item))} />Active</label></div>)}</div></div>
        <label className="block text-sm"><span className="field-label">Privileged reason</span><textarea className="input mt-1 min-h-24" required minLength={1} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /><span className="mt-1 block text-xs text-muted">Required, up to 500 characters.</span></label>
        <Button type="submit" className="btn-primary" disabled={saving || !reason.trim() || reason.trim().length > 500}>{saving ? "Saving…" : "Save settings"}</Button>
      </fieldset>
    </form>
  </section>;
}

export default AdminSettingsEditor;
