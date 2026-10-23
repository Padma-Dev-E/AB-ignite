"use client";

import { useState } from "react";
import { LearningState } from "./learning-cards";
import { useJoinChallenge, useLearningChallenges, useLearningRankings } from "../hooks";

const panel = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const action = "inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50";

function message(error: unknown, fallback: string) { return error instanceof Error && error.message ? error.message : fallback; }

export function LearningRanking() {
  const [scope, setScope] = useState<"bank" | "department">("bank");
  const query = useLearningRankings(scope);
  return <div className="space-y-4"><div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1"><button type="button" className={`rounded-md px-3 py-2 text-sm font-semibold ${scope === "bank" ? "bg-indigo-700 text-white" : "text-slate-700"}`} onClick={() => setScope("bank")}>Whole bank</button><button type="button" className={`rounded-md px-3 py-2 text-sm font-semibold ${scope === "department" ? "bg-indigo-700 text-white" : "text-slate-700"}`} onClick={() => setScope("department")}>My department</button></div>{query.isPending ? <LearningState state="loading" label="Loading the ranking…" /> : query.isError ? <LearningState state="error" label={message(query.error, "The ranking could not be loaded.")} onRetry={() => void query.refetch()} /> : !query.data?.items.length ? <LearningState state="empty" label="No ranking entries are available yet." /> : <ol className={panel}>{query.data.items.map((item) => <li key={`${item.rank}-${item.name}`} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0"><span className="w-8 text-center font-semibold text-slate-500">{item.rank}</span><div className="min-w-0 flex-1"><b className="block truncate text-slate-950">{item.name}</b><span className="text-xs text-slate-600">{item.department}</span></div><span className="font-semibold text-indigo-800">{item.points.toLocaleString()} pts</span></li>)}</ol>}</div>;
}

export function LearningChallenges() {
  const query = useLearningChallenges();
  const join = useJoinChallenge();
  return query.isPending ? <LearningState state="loading" label="Loading open challenges…" /> : query.isError ? <LearningState state="error" label={message(query.error, "Challenges could not be loaded.")} onRetry={() => void query.refetch()} /> : !query.data?.items.length ? <LearningState state="empty" label="No open challenges are available right now." /> : <div className="grid gap-4 md:grid-cols-2">{query.data.items.map((challenge) => <article className={panel} key={challenge.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Open challenge</p><h2 className="mt-1 text-lg font-semibold text-slate-950">{challenge.title}</h2></div><span className="font-semibold text-amber-700">{challenge.points} pts</span></div><p className="mt-2 text-sm text-slate-700">{challenge.question}</p><p className="mt-3 text-xs text-slate-600">{challenge.participants} participants · closes {new Date(challenge.deadlineAt).toLocaleDateString()}</p><button type="button" className={`${action} mt-4`} disabled={challenge.joined || join.isPending} onClick={() => join.mutate({ challengeId: challenge.id })}>{challenge.joined ? "Joined" : join.isPending && join.variables?.challengeId === challenge.id ? "Joining…" : `Join for ${challenge.points} points`}</button>{join.isError && join.variables?.challengeId === challenge.id && <p className="mt-2 text-sm text-red-800" role="alert">{message(join.error, "The challenge could not be joined.")}</p>}{join.isSuccess && join.variables?.challengeId === challenge.id && <p className="mt-2 text-sm text-emerald-800" role="status">Joined and points processed.</p>}</article>)}</div>;
}
