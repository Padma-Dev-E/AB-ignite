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

const categoryNames: Record<string, string> = {
  banking: "Banking Excellence",
  banking_excellence: "Banking Excellence",
  banking_excellence_fundamentals: "Banking Excellence",
  transformation: "Innovation & Business Transformation",
  innovation_and_business_transformation: "Innovation & Business Transformation",
  technology: "Technology & AI",
  technology_and_ai: "Technology & AI",
};

function categoryName(code: string) {
  return categoryNames[code] ?? code.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function topicName(topic: string) {
  return topic.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function JourneyCategory({ category }: { category: LearningJourney["categories"][number] }) {
  const score = Math.max(0, Math.min(100, category.scorePercent));
  return <li className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-center">
    <div className="relative grid size-28 place-items-center rounded-full" style={{ background: `conic-gradient(#e87900 ${score * 3.6}deg, #cbd5e1 0deg)` }} role="img" aria-label={`${categoryName(category.categoryCode)} ${score}%`}>
      <div className="grid size-24 place-items-center rounded-full bg-white text-2xl font-bold text-blue-950">{score}%</div>
    </div>
    <h3 className="mt-4 max-w-64 text-base font-semibold leading-6 text-blue-950">{categoryName(category.categoryCode)}</h3>
    <p className="mt-1 text-sm text-slate-500">{category.totalQuestions ? `${category.totalQuestions} questions across ${category.quizCount ?? 1} ${(category.quizCount ?? 1) === 1 ? "quiz" : "quizzes"} · ${category.totalQuestions < 3 ? "limited" : "moderate"} evidence` : "Not assessed yet"}</p>
  </li>;
}

export type JourneyCardProps = { journey: LearningJourney; onReadArticle?: (articleId: number) => void; onCompleteArticle?: (articleId: number) => void; onRetakeRelatedQuiz?: (articleId: number, relatedQuizId: number | null) => void; pendingArticleId?: number; pendingQuizArticleId?: number; completedArticleIds?: number[]; alreadyCompletedArticleIds?: number[]; articleErrors?: Record<number, string> };

export function JourneyCard({ journey, onReadArticle, onCompleteArticle, onRetakeRelatedQuiz, pendingArticleId, pendingQuizArticleId, completedArticleIds = [], alreadyCompletedArticleIds = [], articleErrors = {} }: JourneyCardProps) {
  const articles = journey.recommendedArticles ?? [];
  const nextArticleId = journey.nextRecommendedArticle?.id ?? articles.find((article) => article.recommendation.id === journey.nextRecommendedStep?.id)?.id ?? articles[0]?.id;
  const improvement = journey.improvement ?? journey.topics.flatMap((topic) => topic.improvement ? [{ topic: topic.topic, ...topic.improvement }] : []);
  const recent = journey.recentQuizzes ?? [];
  const categoryOrder = ["banking", "transformation", "technology"];
  const categories = [...journey.categories].sort((a, b) => categoryOrder.indexOf(a.categoryCode) - categoryOrder.indexOf(b.categoryCode));
  return <div className="space-y-8">
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="learning-journey-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="learning-journey-title" className="text-2xl font-bold text-blue-950">Your Personal Learning Journey</h2><span className="font-semibold text-blue-950" aria-label={`${journey.streakDays ?? 0} day streak`}>💡 {journey.streakDays ?? 0} day streak</span></div>
      <p className="mt-4 max-w-5xl text-base leading-7 text-slate-700">{journey.topics.length ? `Your latest results highlight ${journey.topics.slice(0, 2).map((topic) => topicName(topic.topic)).join(" and ")} as areas to build on. Keep reading and retaking quizzes to strengthen your knowledge.` : "Complete a quiz to start building your personal learning journey and get recommendations for your next steps."}</p>
      <p className="mt-2 text-sm text-slate-500">A quiz score is a pointer, not a verdict on your competence.</p>
      {journey.nextRecommendedStep && <div className="mt-5 rounded-2xl border border-slate-200 p-5"><p className="text-base leading-7 text-slate-700"><strong className="text-blue-950">Next step:</strong> {journey.nextRecommendedArticle?.title ?? topicName(journey.nextRecommendedStep.topic)} <span className="text-slate-500">{journey.nextRecommendedStep.reason}</span></p>{nextArticleId && onReadArticle && <button type="button" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" onClick={() => onReadArticle(nextArticleId)}>Read it</button>}</div>}
      {!journey.nextRecommendedStep && journey.topics.length === 0 && <p className="mt-5 rounded-xl border border-slate-200 p-4 text-slate-600">Your recommendations will appear here after your first quiz.</p>}
      {!!categories.length && <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <JourneyCategory key={category.categoryCode} category={category} />)}</ul>}
    </section>

    <section aria-labelledby="recommended-reading-title">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 id="recommended-reading-title" className="text-2xl font-bold text-blue-950">Recommended reading</h2><span className="text-sm text-slate-500">{articles.length} open</span></div>
      {articles.length ? <ul className="grid gap-5 md:grid-cols-2">{articles.map((article) => {
        const recommendationArticle = article as typeof article & { relatedQuizId?: number | null; completed?: boolean };
        const completed = recommendationArticle.completed || completedArticleIds.includes(article.id) || alreadyCompletedArticleIds.includes(article.id);
        const saving = pendingArticleId === article.id;
        const openingQuiz = pendingQuizArticleId === article.id;
        return <li key={`${article.id}-${article.recommendation.id}`}><article className="h-full rounded-3xl border border-slate-200 border-l-4 border-l-orange-500 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full border border-orange-300 px-4 py-1.5 text-sm font-semibold text-orange-700">✧ Recommended for you</span><time className="text-sm text-slate-500">{article.recommendation.createdAt ? new Date(article.recommendation.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""}</time></div>
          <h3 className="mt-4 text-xl font-bold leading-snug text-blue-950">{article.title}</h3>
          <div className="mt-4 rounded-xl border border-dashed border-orange-300 p-4 text-sm leading-6 text-slate-600"><strong className="text-orange-600">▣ </strong>{article.recommendation.reason}</div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500"><span className="rounded-full border border-slate-300 px-3 py-1 font-semibold">{categoryName(article.category)}</span><span className="rounded-full border border-slate-300 px-3 py-1 font-semibold capitalize">{article.difficulty}</span><span aria-label={`${article.readingMinutes} minute read`}>▯ {article.readingMinutes} min</span></div>
          {article.summary && <p className="mt-4 text-sm leading-6 text-slate-600">{article.summary}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {onReadArticle && <button type="button" className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" onClick={() => onReadArticle(article.id)}>Read</button>}
            {onCompleteArticle && <button type="button" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 font-semibold text-blue-950 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || completed} onClick={() => onCompleteArticle(article.id)}>{saving ? "Saving…" : completed ? "✓ Completed" : "✓ Mark as completed"}</button>}
            {onRetakeRelatedQuiz && <button type="button" className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 px-4 font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={openingQuiz} onClick={() => onRetakeRelatedQuiz(article.id, recommendationArticle.relatedQuizId ?? null)}>{openingQuiz ? "Opening quiz…" : "ϟ Retake a related quiz"}</button>}
          </div>
          {articleErrors[article.id] && <p className="mt-3 text-sm font-medium text-red-700" role="alert">{articleErrors[article.id]}</p>}
        </article></li>;
      })}</ul> : <LearningState state="empty" label="No recommended reading yet. Complete a quiz to get suggestions for your topic gaps." />}
    </section>

    <div className="grid gap-5 lg:grid-cols-2">
      <section className={panelClass} aria-labelledby="topic-standings-title"><h2 id="topic-standings-title" className="text-2xl font-bold text-blue-950">Where you stand by topic</h2><p className="mt-1 text-sm text-slate-500">From your latest attempt of each quiz, weighted by question difficulty.</p>{journey.topics.length ? <ul className="mt-4 divide-y divide-slate-200">{journey.topics.map((topic) => { const score = Math.max(0, Math.min(100, topic.scorePercent)); return <li key={`${topic.categoryCode}-${topic.topic}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0 flex-1"><h3 className="font-semibold text-blue-950">{topicName(topic.topic)}</h3><p className="text-sm text-slate-500">{categoryName(topic.categoryCode)} · {topic.totalQuestions ?? 0} q · {topic.levels?.join(", ") || "Foundation"} · {topic.limitedEvidence ? "limited" : "moderate"} evidence</p></div><div className="flex min-w-32 items-center gap-3"><div className="h-2 flex-1 rounded-full bg-indigo-100"><div className={`h-2 rounded-full ${score >= 70 ? "bg-emerald-600" : "bg-indigo-500"}`} role="progressbar" aria-label={`${topic.topic} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} style={{ width: `${score}%` }} /></div><strong className="w-12 text-right text-blue-950">{score}%</strong></div></li>; })}</ul> : <p className="mt-6 text-sm text-slate-500">Quiz topic results will appear here.</p>}</section>
      <section className={`${panelClass} min-h-72`} aria-labelledby="improvement-title"><h2 id="improvement-title" className="text-2xl font-bold text-blue-950">Improvement over time</h2><p className="mt-1 text-sm text-slate-500">First versus latest score on quizzes you retook.</p>{improvement.length ? <ul className="mt-4 space-y-4">{improvement.map((item) => <li key={item.topic}><div className="flex justify-between gap-3 text-sm font-semibold"><span>{item.topic}</span><span>{item.firstScorePercent}% → {item.latestScorePercent}%</span></div><p className="mt-1 text-xs text-slate-500">{item.attempts} attempts</p></li>)}</ul> : <p className="mt-10 text-center text-base leading-7 text-slate-500">Read a recommended article, then retake the related quiz to measure your improvement.</p>}</section>
    </div>

    <section className={panelClass} aria-labelledby="recent-quizzes-title"><h2 id="recent-quizzes-title" className="text-2xl font-bold text-blue-950">Recent quizzes</h2>{recent.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-3 py-3 font-semibold">Quiz</th><th className="px-3 py-3 font-semibold">Level</th><th className="px-3 py-3 font-semibold">Score</th><th className="px-3 py-3 font-semibold">Result</th><th className="px-3 py-3 font-semibold">Date</th></tr></thead><tbody>{recent.map((item) => <tr key={item.attemptId} className="border-b border-slate-200 text-blue-950"><td className="px-3 py-4">{item.title}</td><td className="px-3 py-4">{item.level}</td><td className="px-3 py-4 font-bold">{item.scorePercent}%</td><td className="px-3 py-4"><span className="rounded-full border border-slate-300 px-3 py-1">{item.passed ? "Passed" : "Below pass mark"}</span></td><td className="px-3 py-4">{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-slate-500">Your completed quizzes will appear here.</p>}</section>
  </div>;
}

function ArticleInsightAction({ article }: { article: LearningArticle }) {
  const insight = useArticleInsight();
  const recommendation = article.recommendation;
  if (!recommendation) return null;
  return <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
    <p className="text-sm font-semibold text-indigo-950">Why this was recommended</p>
    <p className="mt-1 text-xs font-medium text-indigo-800">Topic: {recommendation.topic} · Quiz score: {recommendation.scorePercent}%</p>
    <p className="mt-1 text-sm text-indigo-900">{insight.data?.insight ?? recommendation.reason}</p>
    {insight.data && <p className="mt-1 text-xs text-indigo-700">{insight.data.source === "gemini" ? "AI insight" : "Learning rule insight"}</p>}
    {insight.isPending && <p className="mt-2 text-sm text-indigo-800" role="status">Preparing a recommendation insight…</p>}
    {insight.isError && <p className="mt-2 text-sm text-red-800" role="alert">{insight.error instanceof Error ? insight.error.message : "The insight could not be loaded."}</p>}
    <button type="button" className="mt-2 rounded-md border border-indigo-300 px-3 py-1.5 text-sm font-semibold text-indigo-800 hover:bg-white disabled:opacity-60" disabled={insight.isPending} onClick={() => insight.mutate({ articleId: article.id, recommendationId: recommendation.id })}>{insight.isPending ? "Preparing insight…" : insight.isSuccess ? "Refresh insight" : "Why this was recommended"}</button>
  </div>;
}

export function ArticleCard({ article, onOpen, onComplete, pending = false, completed = false, successMessage, errorMessage }: { article: LearningArticle; onOpen?: () => void; onComplete?: () => void; pending?: boolean; completed?: boolean; successMessage?: string; errorMessage?: string }) {
  const isCompleted = completed || Boolean(successMessage);
  const categoryLabel = ({ banking: "Banking Excellence", transformation: "Innovation & Business Transformation", technology: "Technology & AI" } as Record<string, string>)[article.category] ?? article.category;
  let externalHref: string | null = null;
  if (article.contentType === "external" && article.sourceUrl) {
    try {
      const parsed = new URL(article.sourceUrl);
      if (parsed.protocol === "https:" && parsed.hostname && !parsed.username && !parsed.password) externalHref = parsed.toString();
    } catch { /* Invalid legacy links are never rendered as navigation targets. */ }
  }
  const source = article.contentType === "internal" ? "In-app reading" : externalHref ? new URL(externalHref).hostname : "Source unavailable";
  const publisherInitials = article.publisher === "AB Ignite Learning" ? "AB" : article.publisher.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word.charAt(0)).join("").toUpperCase();
  return <article className="h-full rounded-3xl border border-slate-200 border-l-[3px] border-l-blue-600 bg-white p-5 shadow-sm sm:p-7" aria-labelledby={`article-${article.id}-title`}>
    <div className="flex items-center gap-3"><span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-950 font-serif text-lg font-bold text-white">{publisherInitials}</span><div className="min-w-0"><p className="break-words text-sm font-semibold text-blue-600">{article.publisher}</p><p className="mt-1 break-all text-xs text-slate-500">Source: {source}</p></div></div>
    <h3 id={`article-${article.id}-title`} className="mt-4 text-lg font-bold leading-snug text-slate-900">{article.title}</h3>
    <p className="mt-3 text-sm leading-relaxed text-slate-500">{article.summary}</p>
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600">{categoryLabel}</span><span className="rounded-full border border-blue-200 px-3 py-1 font-semibold capitalize text-blue-600">{article.difficulty}</span><span className="text-slate-500">{article.readingMinutes} min{article.topic ? ` · ${article.topic}` : ""}</span></div>
    {article.recommendation && <ArticleInsightAction article={article} />}
    {!onOpen && article.contentType === "internal" && <Disclosure>
      <DisclosureButton className="mt-4 rounded-md text-sm font-medium text-indigo-800 underline decoration-indigo-300 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">Read article details</DisclosureButton>
      <DisclosurePanel className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{article.body ?? article.summary}</DisclosurePanel>
    </Disclosure>}
    <div className="mt-4 flex flex-wrap gap-2">{externalHref ? <a className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" href={externalHref} target="_blank" rel="noopener noreferrer">Read at source <span className="sr-only">(opens in a new tab)</span></a> : onOpen && article.contentType === "internal" ? <button className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" type="button" onClick={onOpen}>Read</button> : null}{onComplete && <button className={buttonClass} type="button" onClick={onComplete} disabled={pending || isCompleted}>{pending ? "Saving…" : isCompleted ? "Completed" : "Mark as read"}</button>}</div>
    {successMessage && <p className="mt-3 text-sm text-emerald-800" role="status">{successMessage}</p>}{errorMessage && <p className="mt-3 text-sm text-red-800" role="alert">{errorMessage}</p>}
  </article>;
}

export function ArticleList({ articles, onOpen, onComplete, pendingArticleId, completedArticleIds = [] }: { articles: LearningArticle[]; onOpen?: (article: LearningArticle) => void; onComplete?: (article: LearningArticle) => void; pendingArticleId?: number; completedArticleIds?: number[] }) {
  if (!articles.length) return <LearningState state="empty" label="No articles to show right now." />;
  return <ul className="grid gap-4 md:grid-cols-2">{articles.map((article) => <li key={article.id}><ArticleCard article={article} onOpen={onOpen ? () => onOpen(article) : undefined} onComplete={onComplete ? () => onComplete(article) : undefined} pending={pendingArticleId === article.id} completed={completedArticleIds.includes(article.id)} /></li>)}</ul>;
}
