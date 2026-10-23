"use client";

import React from "react";
import type { ReactNode } from "react";
import type { LearningArticle } from "../types";
import { LibraryMetadata, libraryPrimaryButton, librarySecondaryButton, librarySourceUrl } from "./library-shared";

export type LibraryRelatedQuiz = { id: number; title: string };

export type LibraryArticleDetailProps = {
  article: LearningArticle | null;
  onBack: () => void;
  onComplete: (article: LearningArticle) => void;
  relatedQuiz?: LibraryRelatedQuiz | null;
  onRelatedQuiz?: (quizId: number) => void;
  objectives?: string[];
  pending?: boolean;
  completed?: boolean;
  alreadyCompleted?: boolean;
  errorMessage?: string | null;
  loading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
};

function inlineText(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-bold text-[#142950]">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index} className="text-[#60749b]">{part.slice(1, -1)}</em>;
    return part;
  });
}

/** Render the small, safe Markdown subset used by stored article bodies as text nodes. */
export function LibraryArticleBody({ body }: { body: string }) {
  const blocks = body.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/).filter(Boolean);
  return <div className="space-y-5 text-base leading-[1.75] text-[#2c4066] sm:text-[19px] sm:leading-[1.7]">{blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return null;
    if (lines.every((line) => /^[-*]\s+/.test(line))) return <ul key={index} className="list-disc space-y-1 pl-8">{lines.map((line, lineIndex) => <li key={lineIndex}>{inlineText(line.replace(/^[-*]\s+/, ""))}</li>)}</ul>;
    if (lines.every((line) => /^\d+[.)]\s+/.test(line))) return <ol key={index} className="list-decimal space-y-1 pl-8">{lines.map((line, lineIndex) => <li key={lineIndex}>{inlineText(line.replace(/^\d+[.)]\s+/, ""))}</li>)}</ol>;
    if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) return <h2 key={index} className="pt-2 text-xl font-bold text-[#142950]">{lines[0].replace(/^#{1,3}\s+/, "")}</h2>;
    return <p key={index}>{lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{inlineText(line)}</span>)}</p>;
  })}</div>;
}

export function LibraryArticleDetail({ article, onBack, onComplete, relatedQuiz, onRelatedQuiz, objectives, pending = false, completed = false, alreadyCompleted = false, errorMessage, loading = false, loadError, onRetry }: LibraryArticleDetailProps) {
  const done = completed || alreadyCompleted || Boolean(article?.completed);
  const sourceUrl = article ? librarySourceUrl(article) : null;
  const relatedQuizId = relatedQuiz?.id ?? article?.relatedQuizId;
  return <section className="mx-auto w-full max-w-[1230px] pb-12">
    <button className={`${librarySecondaryButton} mb-8`} type="button" onClick={onBack}><span aria-hidden="true" className="text-xl leading-none">‹</span> Library</button>
    {loading ? <div className="rounded-[26px] border border-[#e1e8f5] bg-white p-8 text-[#60749b]" role="status">Loading article…</div> : loadError || !article ? <div className="rounded-[26px] border border-red-200 bg-white p-8" role="alert"><p>{loadError ?? "This article could not be loaded."}</p>{onRetry && <button className={`${libraryPrimaryButton} mt-4`} type="button" onClick={onRetry}>Try again</button>}</div> : <article className="rounded-[26px] border border-[#e1e8f5] bg-white px-6 py-8 shadow-[0_8px_24px_rgba(35,64,124,0.07)] sm:px-9 sm:py-9" aria-labelledby={`library-detail-${article.id}`}>
      <LibraryMetadata article={article} readLabel />
      <h1 id={`library-detail-${article.id}`} className="mt-5 max-w-[1100px] text-3xl font-bold leading-[1.13] tracking-tight text-[#142950] sm:text-[42px]">{article.title}</h1>
      {article.summary && <p className="mt-6 text-lg leading-8 text-[#64799f] sm:text-xl">{article.summary}</p>}
      {objectives && objectives.length > 0 && <section className="mt-5" aria-labelledby="library-objectives-title"><h2 id="library-objectives-title" className="text-lg font-bold text-[#142950]">What you will learn</h2><ul className="mt-2 list-disc space-y-1 pl-8 text-base leading-7 text-[#2c4066] sm:text-lg">{objectives.map((objective, index) => <li key={index}>{objective}</li>)}</ul></section>}
      {article.body ? <div className="mt-6"><LibraryArticleBody body={article.body} /></div> : article.contentType === "external" ? <p className="mt-6 text-[#60749b]">Read the full article at its source.</p> : <p className="mt-6 text-[#60749b]">Article content is not available yet.</p>}
      <div className="mt-9 flex flex-wrap items-center gap-3 border-t border-[#e2e9f5] pt-5">
        {done ? <span className="inline-flex min-h-10 items-center rounded-full border border-[#8fd9c5] px-4 text-sm font-semibold text-[#08a881]" role="status">✓ {alreadyCompleted ? "Already completed" : "Marked as read"}</span> : <button className={libraryPrimaryButton} type="button" disabled={pending} onClick={() => onComplete(article)}><span aria-hidden="true">✓</span> {pending ? "Saving…" : "Mark as completed"}</button>}
        {relatedQuizId && onRelatedQuiz && <button className={`${done ? libraryPrimaryButton : librarySecondaryButton} max-w-full text-left`} type="button" onClick={() => onRelatedQuiz(relatedQuizId)}><span aria-hidden="true">ϟ</span><span className="min-w-0 break-words">{done ? "Take the follow-up quiz" : "Related quiz"}{relatedQuiz?.title ? `: ${relatedQuiz.title}` : ""}</span></button>}
        {sourceUrl && <a className={librarySecondaryButton} href={sourceUrl} target="_blank" rel="noopener noreferrer">Read at source <span className="sr-only">(opens in a new tab)</span></a>}
      </div>
      {errorMessage && <p className="mt-4 text-sm font-medium text-red-700" role="alert">{errorMessage}</p>}
    </article>}
  </section>;
}
