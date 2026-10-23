"use client";

import React, { useState } from "react";
import { LearningState } from "./learning-cards";
import { useJoinChallenge, useLearningChallenges, useLearningRankings } from "../hooks";

const panel = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const action = "inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50";

function message(error: unknown, fallback: string) { return error instanceof Error && error.message ? error.message : fallback; }

export function LearningRanking() {
  const [scope, setScope] = useState<"bank" | "department">("bank");
  const [page, setPage] = useState(1);
  const query = useLearningRankings(scope);
  const items = [...(query.data?.items ?? [])].sort((a, b) => a.rank - b.rank);
  const podium = items.filter((item) => item.rank <= 3);
  const rows = items.filter((item) => item.rank > 3);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  return <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7" aria-labelledby="ranking-title">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl"><h2 id="ranking-title" className="text-2xl font-bold text-slate-900">Innovation Champions <span aria-hidden="true">🏆</span></h2><p className="mt-1 text-sm text-slate-500">Ranked by Ignite Points earned from ideas that progress, quizzes, reading, challenges and helping colleagues.</p></div>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Ranking scope">{(["bank", "department"] as const).map((value) => <button key={value} type="button" aria-pressed={scope === value} className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${scope === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-blue-50"}`} onClick={() => { setScope(value); setPage(1); }}>{value === "bank" ? "Whole bank" : "My department"}</button>)}</div>
    </div>
    {query.isPending ? <LearningState state="loading" label="Loading the ranking…" /> : query.isError ? <LearningState state="error" label={message(query.error, "The ranking could not be loaded.")} onRetry={() => void query.refetch()} /> : !items.length ? <LearningState state="empty" label="No ranking entries are available yet." /> : <>
      <ol aria-label="Top three champions" className="grid items-end gap-3 sm:grid-cols-3">{podium.map((item) => <li key={`${item.rank}-${item.name}`} value={item.rank} className={`relative flex min-w-0 flex-col rounded-t-2xl border border-b-0 p-5 text-center ${item.rank === 1 ? "min-h-64 border-orange-300 bg-gradient-to-b from-orange-50 to-white sm:order-2" : item.rank === 2 ? "min-h-56 border-blue-100 bg-gradient-to-b from-indigo-50 to-white sm:order-1" : "min-h-56 border-blue-100 bg-gradient-to-b from-indigo-50 to-white sm:order-3"}`}>
        <span className="text-3xl" aria-hidden="true">{item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : "🥉"}</span><span className="sr-only">Rank {item.rank}</span>
        <span aria-hidden="true" className={`my-3 flex size-11 items-center justify-center rounded-full font-bold text-white ${item.rank === 1 ? "bg-violet-600" : "bg-blue-500"}`}>{item.name.trim().charAt(0).toUpperCase()}</span>
        <h3 className="break-words text-lg font-bold text-slate-900">{item.name}</h3><p className="mt-1 break-words text-sm text-slate-500">{item.department}</p><p className="mt-3 font-bold text-slate-900"><span aria-hidden="true">💡 </span>{item.points.toLocaleString()}<span className="sr-only"> Ignite Points</span></p>
      </li>)}</ol>
      {rows.length > 0 && <><ol start={visibleRows[0]?.rank ?? 4} aria-label="More champions" className="mt-5 divide-y divide-slate-200">{visibleRows.map((item) => <li key={`${item.rank}-${item.name}`} value={item.rank} className="flex items-center gap-3 py-4 sm:gap-4"><span className="w-7 shrink-0 text-center font-semibold text-slate-500">{item.rank}</span><span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-600 font-bold text-white">{item.name.trim().charAt(0).toUpperCase()}</span><div className="min-w-0 flex-1"><h3 className="break-words font-semibold text-slate-900">{item.name}</h3><p className="break-words text-sm text-slate-500">{item.department}</p></div><span className="shrink-0 font-bold text-slate-900"><span aria-hidden="true">💡 </span>{item.points.toLocaleString()}<span className="sr-only"> Ignite Points</span></span></li>)}</ol>{totalPages > 1 && <nav aria-label="Ranking pages" className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm"><button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-50" disabled={page === 1} onClick={() => setPage(current => current - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)}>Next</button></nav>}</>}
    </>}
  </section>;
}

export function LearningChallenges() {
  const query = useLearningChallenges();
  const join = useJoinChallenge();
  return query.isPending ? <LearningState state="loading" label="Loading open challenges…" /> : query.isError ? <LearningState state="error" label={message(query.error, "Challenges could not be loaded.")} onRetry={() => void query.refetch()} /> : !query.data?.items.length ? <LearningState state="empty" label="No open challenges are available right now." /> : <div className="grid gap-4 md:grid-cols-2">{query.data.items.map((challenge) => <article className={panel} key={challenge.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Open challenge</p><h2 className="mt-1 text-lg font-semibold text-slate-950">{challenge.title}</h2></div><span className="font-semibold text-amber-700">{challenge.points} pts</span></div><p className="mt-2 text-sm text-slate-700">{challenge.question}</p><p className="mt-3 text-xs text-slate-600">{challenge.participants} participant{challenge.participants === 1 ? "" : "s"} · closes {new Date(challenge.deadlineAt).toLocaleDateString()}</p><button type="button" className={`${action} mt-4`} disabled={challenge.joined || join.isPending} onClick={() => join.mutate({ challengeId: challenge.id })}>{challenge.joined ? "Joined" : join.isPending && join.variables?.challengeId === challenge.id ? "Joining…" : `Join for ${challenge.points} points`}</button>{join.isError && join.variables?.challengeId === challenge.id && <p className="mt-2 text-sm text-red-800" role="alert">{message(join.error, "The challenge could not be joined.")}</p>}{join.isSuccess && join.variables?.challengeId === challenge.id && <p className="mt-2 text-sm text-emerald-800" role="status">Joined and points processed.</p>}</article>)}</div>;
}
