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
type RecommendationRule = { topic: string; thresholdPercent: number; reasonTemplate: string; active: boolean };

function message(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Settings could not be saved.";
}

export function AdminSettingsEditor({ className = "" }: AdminSettingsEditorProps) {
  const settings = useAdminSettings();
  const client = useQueryClient();
  const [minimum, setMinimum] = useState<string | null>(null);
  const [pointRules, setPointRules] = useState<PointRule[] | null>(null);
  const [recommendationRules, setRecommendationRules] = useState<RecommendationRule[] | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (settings.isPending) return <section className={`app-card ${className}`} aria-busy="true"><p className="text-sm text-muted" role="status">Loading admin settings…</p></section>;
  if (settings.isError || !settings.data) return <section className={`app-card ${className}`}><p className="text-sm text-[#d6336c]" role="alert">{settings.error instanceof Error ? settings.error.message : "Admin settings could not be loaded."}</p><button type="button" className="btn mt-3" onClick={() => void settings.refetch()}>Try again</button></section>;

  const priorityValue = minimum ?? settings.data.priority.minimum_priority_score ?? "0";
  const points = pointRules ?? settings.data.pointRules.map(({ code, points: value, active }) => ({ code, points: value, active }));
  const recommendations = recommendationRules ?? settings.data.recommendationRules.map(({ topic, thresholdPercent, reasonTemplate, active }) => ({ topic, thresholdPercent, reasonTemplate, active }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedReason = reason.trim();
    const minScore = Number(priorityValue);
    if (!normalizedReason || normalizedReason.length > 500 || !Number.isFinite(minScore) || minScore < 0 || minScore > 3) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      await apiFetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: normalizedReason, priority: { minimum_priority_score: String(minScore) }, pointRules: points, recommendationRules: recommendations }) });
      await client.invalidateQueries({ queryKey: adminQueryKeys.settings });
      setMinimum(null); setPointRules(null); setRecommendationRules(null); setReason(""); setSuccess("Settings saved.");
    } catch (cause) { setError(message(cause)); }
    finally { setSaving(false); }
  }

  return <section className={`app-card ${className}`}>
    <h2 className="text-xl font-medium">Priority settings</h2>
    <p className="mt-1 text-sm text-muted">Changes are recorded in the admin audit log.</p>
    {success && <p className="mt-4 rounded-xl border border-teal/40 bg-teal/5 p-3 text-sm" role="status">{success}</p>}
    {error && <p className="mt-4 rounded-xl border border-pink/40 bg-pink/5 p-3 text-sm text-[#d6336c]" role="alert">{error}</p>}
    <form className="mt-5 space-y-5" onSubmit={submit}>
      <label className="block text-sm"><span className="field-label">Minimum priority score</span><input className="input mt-1 max-w-xs" type="number" min="0" max="3" step="0.01" required value={priorityValue} onChange={(event) => setMinimum(event.target.value)} /><span className="mt-1 block text-xs text-muted">Allowed range: 0–3.</span></label>
      <div><h3 className="font-medium">Point rules</h3><div className="mt-2 divide-y" style={{ borderColor: "var(--line)" }}>{points.map((rule, index) => <div key={rule.code} className="flex flex-wrap items-center gap-3 py-2"><span className="min-w-32 flex-1 text-sm">{settings.data.pointRules[index]?.name ?? rule.code}</span><label className="text-sm">Points <input className="input ml-1 w-24" type="number" min="0" max="100000" step="1" value={rule.points} onChange={(event) => setPointRules(points.map((item, i) => i === index ? { ...item, points: Number(event.target.value) } : item))} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.active} onChange={(event) => setPointRules(points.map((item, i) => i === index ? { ...item, active: event.target.checked } : item))} />Active</label></div>)}</div></div>
      <div><h3 className="font-medium">Recommendation rules</h3><div className="mt-2 space-y-3">{recommendations.map((rule, index) => <fieldset key={rule.topic} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><legend className="px-1 text-sm font-medium">{rule.topic}</legend><div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end"><label className="text-sm">Threshold (%)<input className="input mt-1 w-full" type="number" min="0" max="100" step="1" value={rule.thresholdPercent} onChange={(event) => setRecommendationRules(recommendations.map((item, i) => i === index ? { ...item, thresholdPercent: Number(event.target.value) } : item))} /></label><label className="text-sm">Reason template<input className="input mt-1 w-full" maxLength={500} required value={rule.reasonTemplate} onChange={(event) => setRecommendationRules(recommendations.map((item, i) => i === index ? { ...item, reasonTemplate: event.target.value } : item))} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.active} onChange={(event) => setRecommendationRules(recommendations.map((item, i) => i === index ? { ...item, active: event.target.checked } : item))} />Active</label></div></fieldset>)}</div></div>
      <label className="block text-sm"><span className="field-label">Privileged reason</span><textarea className="input mt-1 min-h-24" required minLength={1} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /><span className="mt-1 block text-xs text-muted">Required, up to 500 characters.</span></label>
      <Button type="submit" className="btn-primary" disabled={saving || !reason.trim() || reason.trim().length > 500}>{saving ? "Saving…" : "Save settings"}</Button>
    </form>
  </section>;
}

export default AdminSettingsEditor;
