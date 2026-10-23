"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import React from "react";
import type { ReactNode } from "react";
import type { LearningArticle, LearningJourney, QuizSummary } from "../types";

type State = "loading" | "error" | "empty" | "success";
const panelClass = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const buttonClass = "inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";

export function LearningState({ state, label, onRetry, children }: { state: State; label?: string; onRetry?: () => void; children?: ReactNode }) {
  if (state === "success") return <>{children}</>;
  if (state === "loading") return <div className={panelClass} role="status" aria-live="polite"><span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-indigo-600" aria-hidden="true" />{label ?? "Loading learning content…"}</div>;
  if (state === "error") return <div className={panelClass} role="alert"><p className="font-semibold">{label ?? "Learning content could not be loaded."}</p>{onRetry && <button className={`${buttonClass} mt-3`} onClick={onRetry} type="button">Try again</button>}</div>;
  return <div className={panelClass} role="status"><p className="font-semibold">{label ?? "Nothing to show yet."}</p>{children}</div>;
}

export function QuizCard({ quiz, onStart, pending = false, successMessage, errorMessage }: { quiz: QuizSummary; onStart?: () => void; pending?: boolean; successMessage?: string; errorMessage?: string }) {
  return <article className={panelClass} aria-labelledby={`quiz-${quiz.id}-title`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id={`quiz-${quiz.id}-title`} className="text-lg font-semibold text-slate-950">{quiz.title}</h3><p className="mt-1 text-sm text-slate-600">{quiz.category} · {quiz.level} · {quiz.questionCount} questions</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-800">Pass {quiz.passMark}%</span></div>
    <Disclosure>
      <DisclosureButton className="mt-4 rounded-md text-sm font-medium text-indigo-800 underline decoration-indigo-300 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">Quiz details</DisclosureButton>
      <DisclosurePanel className="mt-3 text-sm text-slate-700">{quiz.objective}{quiz.timeLimitSeconds ? ` · ${Math.ceil(quiz.timeLimitSeconds / 60)} minute limit` : ""}</DisclosurePanel>
    </Disclosure>
    {onStart && <button className={`${buttonClass} mt-4`} type="button" onClick={onStart} disabled={pending}>{pending ? "Starting…" : "Start quiz"}</button>}
    {successMessage && <p className="mt-3 text-sm text-emerald-800" role="status">{successMessage}</p>}{errorMessage && <p className="mt-3 text-sm text-red-800" role="alert">{errorMessage}</p>}
  </article>;
}

export function QuizList({ quizzes, onStart, pendingQuizId }: { quizzes: QuizSummary[]; onStart?: (quiz: QuizSummary) => void; pendingQuizId?: number }) {
  if (!quizzes.length) return <LearningState state="empty" label="No quizzes are available right now." />;
  return <ul className="grid gap-4 md:grid-cols-2">{quizzes.map((quiz) => <li key={quiz.id}><QuizCard quiz={quiz} onStart={onStart ? () => onStart(quiz) : undefined} pending={pendingQuizId === quiz.id} /></li>)}</ul>;
}

export function JourneyCard({ journey }: { journey: LearningJourney }) {
  return <section className={panelClass} aria-labelledby="learning-journey-title">
    <h2 id="learning-journey-title" className="text-lg font-semibold text-slate-950">Your learning journey</h2>
    {journey.nextRecommendedStep && <div className="mt-3 rounded-lg bg-indigo-50 p-4"><p className="text-sm font-semibold text-indigo-950">Recommended next: {journey.nextRecommendedStep.topic}</p><p className="mt-1 text-sm text-indigo-900">{journey.nextRecommendedStep.reason}</p></div>}
    {!journey.nextRecommendedStep && journey.topics.length === 0 && <p className="mt-3 text-sm text-slate-700">Complete a quiz to start building your learning journey.</p>}
    {journey.topics.length > 0 && <ul className="mt-4 space-y-3">{journey.topics.map((topic) => <li key={`${topic.categoryCode}-${topic.topic}`}><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-slate-900">{topic.topic}</span><span className="text-slate-700">{topic.scorePercent}%</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-600" role="progressbar" aria-label={`${topic.topic} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={topic.scorePercent} style={{ width: `${Math.max(0, Math.min(100, topic.scorePercent))}%` }} /></div></li>)}</ul>}
  </section>;
}

export function ArticleCard({ article, onComplete, pending = false, completed = false, successMessage, errorMessage }: { article: LearningArticle; onComplete?: () => void; pending?: boolean; completed?: boolean; successMessage?: string; errorMessage?: string }) {
  return <article className={panelClass} aria-labelledby={`article-${article.id}-title`}>
    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">{article.publisher} · {article.readingMinutes} min read</p>
    <h3 id={`article-${article.id}-title`} className="mt-2 text-lg font-semibold text-slate-950">{article.title}</h3>
    <p className="mt-1 text-sm text-slate-700">{article.summary}</p>
    {article.recommendation && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{article.recommendation.reason}</p>}
    <Disclosure>
      <DisclosureButton className="mt-4 rounded-md text-sm font-medium text-indigo-800 underline decoration-indigo-300 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">Read article details</DisclosureButton>
      <DisclosurePanel className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{article.body ?? (article.sourceUrl ? <a className="underline" href={article.sourceUrl} target="_blank" rel="noreferrer">Read at {article.publisher} (opens in a new tab)</a> : article.summary)}</DisclosurePanel>
    </Disclosure>
    {onComplete && <button className={`${buttonClass} mt-4`} type="button" onClick={onComplete} disabled={pending || completed}>{pending ? "Saving…" : completed ? "Completed" : "Mark as read"}</button>}
    {successMessage && <p className="mt-3 text-sm text-emerald-800" role="status">{successMessage}</p>}{errorMessage && <p className="mt-3 text-sm text-red-800" role="alert">{errorMessage}</p>}
  </article>;
}

export function ArticleList({ articles, onComplete, pendingArticleId, completedArticleIds = [] }: { articles: LearningArticle[]; onComplete?: (article: LearningArticle) => void; pendingArticleId?: number; completedArticleIds?: number[] }) {
  if (!articles.length) return <LearningState state="empty" label="No articles to show right now." />;
  return <ul className="grid gap-4 md:grid-cols-2">{articles.map((article) => <li key={article.id}><ArticleCard article={article} onComplete={onComplete ? () => onComplete(article) : undefined} pending={pendingArticleId === article.id} completed={completedArticleIds.includes(article.id)} /></li>)}</ul>;
}
