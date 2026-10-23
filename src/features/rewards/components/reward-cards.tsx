"use client";

import { Dialog, DialogPanel, DialogTitle, Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import React from "react";
import type { BadgeProgress, Redemption, Reward, RewardsBalance } from "../types";

const cardClass = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const actionClass = "inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";

export function RewardsState({ state, onRetry, label }: { state: "loading" | "error" | "empty" | "success"; onRetry?: () => void; label?: string }) {
  if (state === "success") return null;
  if (state === "loading") return <div className={cardClass} role="status" aria-live="polite">{label ?? "Loading your rewards…"}</div>;
  if (state === "error") return <div className={cardClass} role="alert"><p>{label ?? "Your rewards could not be loaded."}</p>{onRetry && <button type="button" className={`${actionClass} mt-3`} onClick={onRetry}>Try again</button>}</div>;
  return <div className={cardClass} role="status">{label ?? "No rewards are available yet."}</div>;
}

export function RewardCard({ reward, balance, onRedeem, pending = false, successMessage, errorMessage }: { reward: Reward; balance: number; onRedeem?: () => void; pending?: boolean; successMessage?: string; errorMessage?: string }) {
  const canAfford = balance >= reward.cost;
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const confirm = () => {
    setConfirmOpen(false);
    onRedeem?.();
  };
  return <article className={cardClass} aria-labelledby={`reward-${reward.id}-title`}>
    <div className="flex items-start gap-3"><span className="text-2xl" aria-hidden="true">{reward.emoji ?? "★"}</span><div className="min-w-0 flex-1"><h3 id={`reward-${reward.id}-title`} className="font-semibold text-slate-950">{reward.name}</h3>{reward.description && <p className="mt-1 text-sm text-slate-700">{reward.description}</p>}</div></div>
    <Disclosure><DisclosureButton className="mt-3 rounded-md text-sm font-medium text-indigo-800 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">Point details</DisclosureButton><DisclosurePanel className="mt-2 text-sm text-slate-700">Costs {reward.cost} points. Your available balance is {balance} points.</DisclosurePanel></Disclosure>
    {onRedeem && <><button type="button" className={`${actionClass} mt-4`} onClick={() => setConfirmOpen(true)} disabled={!canAfford || pending}>{pending ? "Requesting…" : canAfford ? `Redeem for ${reward.cost} points` : `Need ${reward.cost - balance} more points`}</button>{successMessage && <p className="mt-3 text-sm text-emerald-800" role="status">{successMessage}</p>}{errorMessage && <p className="mt-3 text-sm text-red-800" role="alert">{errorMessage}</p>}<Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} className="relative z-50"><div className="fixed inset-0 bg-slate-950/30" aria-hidden="true" /><div className="fixed inset-0 grid place-items-center p-4"><DialogPanel className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"><DialogTitle className="text-lg font-semibold text-slate-950">Confirm redemption</DialogTitle><p className="mt-2 text-sm text-slate-700">Redeem <b>{reward.name}</b> for <b>{reward.cost.toLocaleString()} points</b>? The points will be deducted immediately and the request will be sent to the innovation team.</p><p className="mt-2 text-sm text-slate-600">Available after redemption: {(balance - reward.cost).toLocaleString()} points.</p><div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800" onClick={() => setConfirmOpen(false)}>Cancel</button><button type="button" className={actionClass} onClick={confirm} disabled={pending}>{pending ? "Requesting…" : "Confirm redemption"}</button></div></DialogPanel></div></Dialog></>}
  </article>;
}

export function RewardsBalanceCard({ balance, level }: { balance: RewardsBalance; level?: { name: string; minimumPoints: number } | null }) {
  return <section className={`${cardClass} border-indigo-200 bg-indigo-50`} aria-labelledby="rewards-balance-title">
    <h2 id="rewards-balance-title" className="text-sm font-semibold text-indigo-950">Available points</h2>
    <p className="mt-1 text-3xl font-bold tabular-nums text-indigo-950" aria-live="polite">{balance.balance.toLocaleString()}</p>
    {level && <p className="mt-2 text-sm text-indigo-900">{level.name} · next level progress starts at {level.minimumPoints.toLocaleString()} points</p>}
  </section>;
}

export function RewardCatalogue({ rewards, balance, onRedeem, pendingRewardId }: { rewards: Reward[]; balance: number; onRedeem?: (reward: Reward) => void; pendingRewardId?: number }) {
  if (!rewards.length) return <RewardsState state="empty" label="The reward catalogue is empty right now." />;
  return <ul className="grid gap-4 md:grid-cols-2">{rewards.map((reward) => <li key={reward.id}><RewardCard reward={reward} balance={balance} onRedeem={onRedeem ? () => onRedeem(reward) : undefined} pending={pendingRewardId === reward.id} /></li>)}</ul>;
}

export function RedemptionHistory({ redemptions }: { redemptions: Redemption[] }) {
  if (!redemptions.length) return <p className={cardClass} role="status">No redemptions yet.</p>;
  return <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white" aria-label="Your redemptions">{redemptions.map((redemption) => <li key={redemption.id} className="flex flex-wrap items-center justify-between gap-2 p-4"><div><span className="font-medium text-slate-950">{redemption.rewardName}</span><time className="mt-1 block text-xs text-slate-600" dateTime={redemption.requestedAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(redemption.requestedAt))}</time></div><span className="text-sm capitalize text-slate-700">{redemption.status} · {redemption.cost} points</span></li>)}</ul>;
}

export function BadgeProgressList({ badges }: { badges: BadgeProgress[] }) {
  if (!badges.length) return <p className={cardClass} role="status">No badges are configured yet.</p>;
  return <ul className="grid gap-3 sm:grid-cols-2" aria-label="Your badges">{badges.map((badge) => {
    const awarded = Boolean(badge.awarded);
    let ruleLabel = "";
    try { const rule = badge.ruleJson ? JSON.parse(badge.ruleJson) as { eventTypes?: string[]; minimumCount?: number } : null; if (rule?.eventTypes?.length) ruleLabel = `Rule: ${rule.eventTypes.join(", ")} · ${rule.minimumCount ?? 1} event${(rule.minimumCount ?? 1) === 1 ? "" : "s"}`; } catch { ruleLabel = ""; }
    return <li key={badge.id} className={`${cardClass} ${awarded ? "border-amber-300 bg-amber-50" : "opacity-70"}`}><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-xl" aria-hidden="true">{awarded ? "🏅" : "🔒"}</span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{badge.name}</h3><span className="text-xs font-medium uppercase tracking-wide text-slate-600">{awarded ? "Unlocked" : "In progress"}</span></div>{badge.description && <p className="mt-1 text-sm text-slate-700">{badge.description}</p>}{ruleLabel && <p className="mt-2 text-xs text-slate-600">{ruleLabel}</p>}{awarded && <p className="mt-2 text-xs text-amber-900">Milestone unlocked and recorded in your recognition history.</p>}</div></div></li>;
  })}</ul>;
}
