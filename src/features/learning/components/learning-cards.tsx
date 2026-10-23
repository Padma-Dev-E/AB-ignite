"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import React from "react";
import type { ReactNode } from "react";
import type { LearningArticle, LearningJourney, QuizSummary } from "../types";
import { useArticleInsight } from "../hooks";

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
  const categories = journey.categories;
  return <section className={panelClass} aria-labelledby="learning-journey-title">
    <h2 id="learning-journey-title" className="text-lg font-semibold text-slate-950">Your learning journey</h2>
    {journey.nextRecommendedStep && <div className="mt-3 rounded-lg bg-indigo-50 p-4"><p className="text-sm font-semibold text-indigo-950">Recommended next: {journey.nextRecommendedStep.topic}</p><p className="mt-1 text-sm text-indigo-900">{journey.nextRecommendedStep.reason}</p></div>}
    {!journey.nextRecommendedStep && journey.topics.length === 0 && <p className="mt-3 text-sm text-slate-700">Complete a quiz to start building your learning journey.</p>}
    {categories.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold text-slate-900">Category strengths</h3><ul className="mt-2 grid gap-2 sm:grid-cols-3">{categories.map((category) => <li key={category.categoryCode} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-medium uppercase tracking-wide text-slate-600">{category.categoryCode}</p><p className="mt-1 text-lg font-semibold text-slate-950">{category.scorePercent}%</p><p className="text-xs text-slate-600">{category.correctCount} of {category.totalQuestions} correct</p></li>)}</ul></div>}
    {journey.topics.length > 0 && <ul className="mt-4 space-y-3">{journey.topics.map((topic) => <li key={`${topic.categoryCode}-${topic.topic}`}><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-slate-900">{topic.topic}</span><span className="text-slate-700">{topic.scorePercent}%</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-600" role="progressbar" aria-label={`${topic.topic} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={topic.scorePercent} style={{ width: `${Math.max(0, Math.min(100, topic.scorePercent))}%` }} /></div></li>)}</ul>}
    {journey.topics.some((topic) => topic.trend.length > 1) && <div className="mt-5"><h3 className="text-sm font-semibold text-slate-900">Attempt trend</h3><ul className="mt-2 space-y-3">{journey.topics.filter((topic) => topic.trend.length > 1).map((topic) => {
      const values = topic.trend.map((value) => Math.max(0, Math.min(100, value)));
      const points = values.map((value, index) => `${values.length === 1 ? 50 : (index / (values.length - 1)) * 100},${100 - value}`).join(" ");
      return <li key={`${topic.categoryCode}-${topic.topic}-trend`}><div className="flex justify-between text-xs text-slate-600"><span>{topic.topic}</span><span>{values.length} attempts · latest {values.at(-1)}%</span></div><svg className="mt-1 h-12 w-full overflow-visible rounded bg-slate-50" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${topic.topic} attempt trend: ${values.join(", ")} percent`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" vectorEffect="non-scaling-stroke" className="text-indigo-600" /></svg></li>;
    })}</ul></div>}
  </section>;
}

function ArticleInsightAction({ article }: { article: LearningArticle }) {
  const insight = useArticleInsight();
  const recommendation = article.recommendation;
  if (!recommendation) return null;
  return <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
    <p className="text-sm font-semibold text-indigo-950">Why this was recommended</p>
    <p className="mt-1 text-sm text-indigo-900">{insight.data?.insight ?? recommendation.reason}</p>
    {insight.data && <p className="mt-1 text-xs text-indigo-700">{insight.data.source === "gemini" ? "AI insight" : "Learning rule insight"}</p>}
    {insight.isPending && <p className="mt-2 text-sm text-indigo-800" role="status">Preparing a recommendation insight…</p>}
    {insight.isError && <p className="mt-2 text-sm text-red-800" role="alert">{insight.error instanceof Error ? insight.error.message : "The insight could not be loaded."}</p>}
    <button type="button" className="mt-2 rounded-md border border-indigo-300 px-3 py-1.5 text-sm font-semibold text-indigo-800 hover:bg-white disabled:opacity-60" disabled={insight.isPending} onClick={() => insight.mutate({ articleId: article.id, recommendationId: recommendation.id })}>{insight.isPending ? "Preparing insight…" : insight.isSuccess ? "Refresh insight" : "Why this was recommended"}</button>
  </div>;
}

export function ArticleCard({ article, onOpen, onComplete, pending = false, completed = false, successMessage, errorMessage }: { article: LearningArticle; onOpen?: () => void; onComplete?: () => void; pending?: boolean; completed?: boolean; successMessage?: string; errorMessage?: string }) {
  return <article className={panelClass} aria-labelledby={`article-${article.id}-title`}>
    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">{article.publisher} · {article.readingMinutes} min read</p>
    <h3 id={`article-${article.id}-title`} className="mt-2 text-lg font-semibold text-slate-950">{article.title}</h3>
    <p className="mt-1 text-sm text-slate-700">{article.summary}</p>
    {article.recommendation && <ArticleInsightAction article={article} />}
    <Disclosure>
      <DisclosureButton className="mt-4 rounded-md text-sm font-medium text-indigo-800 underline decoration-indigo-300 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">Read article details</DisclosureButton>
      <DisclosurePanel className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{article.body ?? (article.sourceUrl ? <a className="underline" href={article.sourceUrl} target="_blank" rel="noreferrer">Read at {article.publisher} (opens in a new tab)</a> : article.summary)}</DisclosurePanel>
    </Disclosure>
    <div className="mt-4 flex flex-wrap gap-2">{onOpen && <button className="inline-flex min-h-10 items-center justify-center rounded-lg border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-50" type="button" onClick={onOpen}>Open article</button>}{onComplete && <button className={buttonClass} type="button" onClick={onComplete} disabled={pending || completed}>{pending ? "Saving…" : completed ? "Completed" : "Mark as read"}</button>}</div>
    {successMessage && <p className="mt-3 text-sm text-emerald-800" role="status">{successMessage}</p>}{errorMessage && <p className="mt-3 text-sm text-red-800" role="alert">{errorMessage}</p>}
  </article>;
}

export function ArticleList({ articles, onOpen, onComplete, pendingArticleId, completedArticleIds = [] }: { articles: LearningArticle[]; onOpen?: (article: LearningArticle) => void; onComplete?: (article: LearningArticle) => void; pendingArticleId?: number; completedArticleIds?: number[] }) {
  if (!articles.length) return <LearningState state="empty" label="No articles to show right now." />;
  return <ul className="grid gap-4 md:grid-cols-2">{articles.map((article) => <li key={article.id}><ArticleCard article={article} onOpen={onOpen ? () => onOpen(article) : undefined} onComplete={onComplete ? () => onComplete(article) : undefined} pending={pendingArticleId === article.id} completed={completedArticleIds.includes(article.id)} /></li>)}</ul>;
}
