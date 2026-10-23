"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LearningState } from "./learning-cards";
import { useQuizAttempt, useQuizzes, useStartQuizAttempt, useSubmitQuizAttempt } from "../hooks";
import type { QuizAnswer, QuizQuestion, QuizSummary } from "../types";

const panel = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const action = "inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
const resumeStorageKey = "ab-ignite-learning-active-attempt";

function errorText(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
function secondsLeft(expiresAt: string | null, now: number) {
  return expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000)) : null;
}
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

function QuizCatalogue({ quizzes, pendingId, onStart, error }: { quizzes: QuizSummary[]; pendingId?: number; onStart: (quiz: QuizSummary) => void; error?: string }) {
  if (!quizzes.length) return <LearningState state="empty" label="No quizzes are available right now. Check back soon." />;
  return <div className="space-y-3">{error && <p className={`${panel} border-red-200 text-sm text-red-800`} role="alert">{error}</p>}
    <ul className="grid gap-4 md:grid-cols-2">{quizzes.map((quiz) => <li key={quiz.id} className={panel}>
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-slate-950">{quiz.title}</h3><p className="mt-1 text-sm text-slate-600">{quiz.category} · {quiz.level} · {quiz.questionCount} questions</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-800">Pass {quiz.passMark}%</span></div>
      <p className="mt-3 text-sm text-slate-700">{quiz.objective}</p><p className="mt-2 text-xs text-slate-500">{quiz.timeLimitSeconds ? `${Math.ceil(quiz.timeLimitSeconds / 60)} minute limit` : "No time limit"} · Points are awarded according to your first eligible attempt.</p>
      <button type="button" className={`${action} mt-4`} disabled={pendingId !== undefined} onClick={() => onStart(quiz)}>{pendingId === quiz.id ? "Starting…" : "Start quiz"}</button>
    </li>)}</ul>
  </div>;
}

function QuizResult({ result, onReplay }: { result: NonNullable<ReturnType<typeof useQuizAttempt>["data"]>["result"]; onReplay: () => void }) {
  if (!result) return <LearningState state="loading" label="Loading your quiz result…" />;
  const expired = result.status === "expired";
  return <section className={panel} aria-labelledby="quiz-result-title">
    <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">{expired ? "Time is up" : result.passed ? "Quiz passed" : "Quiz complete"}</p>
    <h2 id="quiz-result-title" className="mt-2 text-2xl font-bold text-slate-950">{expired ? "Your attempt expired" : `${result.scorePercent}%`}</h2>
    <p className="mt-2 text-slate-700">{expired ? "Your answers were submitted when the server timer expired." : `${result.correctCount} of ${result.totalQuestions} correct · ${result.passed ? `Pass mark ${result.passMark}%` : `Pass mark ${result.passMark}% not reached`}.`}</p>
    {!expired && <div className="mt-4 rounded-lg bg-indigo-50 p-4"><p className="font-semibold text-indigo-950">{result.pointsAwarded > 0 ? `+${result.pointsAwarded} points` : "No points awarded"}</p><p className="mt-1 text-sm text-indigo-900">{result.pointsAwarded > 0 ? "Points have been credited for this attempt." : result.pointsStatus === "pending" ? "Your points are being processed." : result.firstAttempt ? "Points are not available for this score." : "Points are awarded on the first eligible attempt."}</p></div>}
    <button className={`${action} mt-5`} type="button" onClick={onReplay}>Back to quizzes</button>
  </section>;
}

export function QuizJourney() {
  const catalogue = useQuizzes();
  const start = useStartQuizAttempt();
  const submit = useSubmitQuizAttempt();
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const timeoutSubmittedFor = useRef<number | null>(null);
  const attemptQuery = useQuizAttempt(attemptId ?? 0, attemptId !== null);
  const attempt = attemptQuery.data?.attempt;
  const questions = attempt?.questions ?? [];
  const currentQuestion = questions[questionIndex];
  const remaining = secondsLeft(attempt?.expiresAt ?? null, now);
  const answerList = useMemo<QuizAnswer[]>(() => questions.flatMap((question) => answers[question.id] ? [{ questionId: question.id, optionKey: answers[question.id] }] : []), [answers, questions]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(resumeStorageKey);
    if (stored && /^\d+$/.test(stored)) setAttemptId(Number(stored));
  }, []);
  useEffect(() => { if (attemptId !== null) window.sessionStorage.setItem(resumeStorageKey, String(attemptId)); }, [attemptId]);
  useEffect(() => {
    if (!attempt?.expiresAt || attempt.status !== "in_progress") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.expiresAt, attempt?.status]);
  useEffect(() => {
    if (attempt?.status === "in_progress" && remaining === 0 && !submit.isPending && timeoutSubmittedFor.current !== attempt.id) {
      timeoutSubmittedFor.current = attempt.id;
      submit.mutate({ attemptId: attempt.id, answers: answerList });
    }
  }, [attempt?.id, attempt?.status, remaining, submit.isPending, answerList]);
  useEffect(() => {
    if (attempt?.status === "in_progress") {
      const refresh = window.setInterval(() => void attemptQuery.refetch(), 5000);
      return () => window.clearInterval(refresh);
    }
  }, [attempt?.id, attempt?.status, attemptQuery.refetch]);

  const begin = (quiz: QuizSummary) => {
    start.mutate({ quizId: quiz.id }, { onSuccess: ({ attempt: started }) => {
      setAnswers({}); setQuestionIndex(0); setNow(Date.now()); timeoutSubmittedFor.current = null; setAttemptId(started.id);
    } });
  };
  const leaveResult = () => { window.sessionStorage.removeItem(resumeStorageKey); setAttemptId(null); setAnswers({}); setQuestionIndex(0); timeoutSubmittedFor.current = null; submit.reset(); start.reset(); };

  if (attemptId !== null) {
    if (attemptQuery.isPending || !attempt) return <LearningState state="loading" label="Restoring your quiz attempt…" />;
    if (attemptQuery.isError) return <div className="space-y-3"><LearningState state="error" label={errorText(attemptQuery.error, "Your attempt could not be loaded.")} onRetry={() => void attemptQuery.refetch()} /><button className={action} type="button" onClick={leaveResult}>Back to quizzes</button></div>;
    if (attempt.status !== "in_progress") return <QuizResult result={attemptQuery.data.result} onReplay={leaveResult} />;
    if (!questions.length || !currentQuestion) return <LearningState state="error" label="This attempt has no available questions." />;
    return <QuizQuestionView
      question={currentQuestion} index={questionIndex} count={questions.length} selected={answers[currentQuestion.id] ?? ""}
      remaining={remaining} submitting={submit.isPending} submitError={submit.isError ? errorText(submit.error, "Your answers could not be submitted.") : undefined}
      onSelect={(key) => setAnswers((current) => ({ ...current, [currentQuestion.id]: key }))}
      onPrevious={() => setQuestionIndex((index) => Math.max(0, index - 1))}
      onNext={() => setQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}
      onSubmit={() => submit.mutate({ attemptId: attempt.id, answers: answerList })}
    />;
  }

  return catalogue.isPending ? <LearningState state="loading" label="Loading quizzes…" />
    : catalogue.isError ? <LearningState state="error" label="Quizzes could not be loaded." onRetry={() => void catalogue.refetch()} />
      : <QuizCatalogue quizzes={catalogue.data.items} pendingId={start.isPending ? start.variables?.quizId : undefined} onStart={begin} error={start.isError ? errorText(start.error, "The quiz could not be started.") : undefined} />;
}

function QuizQuestionView({ question, index, count, selected, remaining, submitting, submitError, onSelect, onPrevious, onNext, onSubmit }: { question: QuizQuestion; index: number; count: number; selected: string; remaining: number | null; submitting: boolean; submitError?: string; onSelect: (key: string) => void; onPrevious: () => void; onNext: () => void; onSubmit: () => void }) {
  const finalQuestion = index === count - 1;
  return <section className={panel} aria-labelledby="quiz-question-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-indigo-800">Question {index + 1} of {count}</p>{remaining !== null && <p className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${remaining <= 30 ? "bg-red-50 text-red-800" : "bg-indigo-50 text-indigo-800"}`} role="timer" aria-live="off">Time remaining: {formatTime(remaining)}</p>}</div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600 transition-[width]" style={{ width: `${((index + 1) / count) * 100}%` }} /></div>
    {question.topic && <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{question.topic}</p>}
    <h2 id="quiz-question-title" className="mt-2 text-xl font-semibold leading-snug text-slate-950">{question.prompt}</h2>
    <fieldset className="mt-5 space-y-3"><legend className="sr-only">Choose one answer</legend>{question.options.map((option) => <label key={option.optionKey} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm transition ${selected === option.optionKey ? "border-indigo-600 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"}`}><input className="mt-0.5 accent-indigo-700" type="radio" name={`question-${question.id}`} value={option.optionKey} checked={selected === option.optionKey} onChange={() => onSelect(option.optionKey)} /><span>{option.label}</span></label>)}</fieldset>
    {submitError && <p className="mt-4 text-sm text-red-800" role="alert">{submitError}</p>}
    <div className="mt-6 flex flex-wrap justify-between gap-3"><button type="button" className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50" onClick={onPrevious} disabled={index === 0 || submitting}>Previous</button>{finalQuestion ? <button type="button" className={action} onClick={onSubmit} disabled={submitting}>{submitting ? "Submitting…" : "Finish quiz"}</button> : <button type="button" className={action} onClick={onNext} disabled={submitting}>{selected ? "Next question" : "Skip for now"}</button>}</div>
  </section>;
}
