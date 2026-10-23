"use client";

import React from "react";
import type { LearningArticle } from "../types";
import { LibraryMetadata, libraryCategories, libraryPrimaryButton, librarySource, type LibraryFilter } from "./library-shared";

export type LibraryCatalogueProps = {
  articles: LearningArticle[];
  recommendedArticles?: LearningArticle[];
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
  onRead: (article: LearningArticle) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  page?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
};

export function LibraryCatalogue({ articles, recommendedArticles, filter, onFilterChange, onRead, loading = false, error, onRetry, page = 1, pageSize = 12, onPageChange }: LibraryCatalogueProps) {
  const recommendations = recommendedArticles ?? articles.filter((article) => Boolean(article.recommendation));
  const recommendedIds = new Set(recommendations.map((article) => article.id));
  const filtered = filter === "recommended" ? recommendations : filter === "all" ? articles : articles.filter((article) => article.category === filter);
  const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / safePageSize));
  const currentPage = Math.max(1, Math.min(Math.floor(page) || 1, pageCount));
  const visible = filtered.slice((currentPage - 1) * safePageSize, currentPage * safePageSize);

  return <section className="mx-auto w-full max-w-[1230px] space-y-8 pb-12" aria-labelledby="library-title">
    <div className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-r from-[#102e7c] to-[#245cff] px-7 py-9 text-white sm:px-10 sm:py-10">
      <div className="relative z-10 max-w-[780px]"><h1 id="library-title" className="text-3xl font-bold tracking-tight sm:text-[42px] sm:leading-tight">Library <span aria-hidden="true">📚</span></h1><p className="mt-2 max-w-[760px] text-base leading-7 text-[#d8e3ff] sm:text-lg">Reading on banking, transformation and technology. Articles recommended from your quiz results are marked.</p></div>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-4 hidden h-36 items-end gap-2 opacity-45 md:flex"><i className="h-[88px] w-8 rounded-t-lg bg-[#78a5ff]"/><i className="h-[118px] w-9 rounded-t-lg bg-[#78a5ff]"/><i className="h-[75px] w-8 rounded-t-lg bg-[#78a5ff]"/><i className="h-[130px] w-10 rounded-t-lg bg-[#78a5ff]"/><i className="h-[92px] w-8 rounded-t-lg bg-[#78a5ff]"/><i className="h-[68px] w-9 rotate-[12deg] rounded-t-lg bg-[#78a5ff]"/></div>
    </div>

    <div className="flex w-full overflow-x-auto rounded-2xl border border-[#e1e8f5] bg-white p-1.5 sm:w-fit" role="tablist" aria-label="Filter library articles">
      {libraryCategories.map((category) => <button key={category.id} type="button" role="tab" aria-selected={filter === category.id} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#245cff] ${filter === category.id ? "bg-[#245cff] text-white" : "text-[#60749b] hover:bg-[#f1f5ff]"}`} onClick={() => onFilterChange(category.id)}>{category.label}{category.id === "recommended" ? ` (${recommendations.length})` : ""}</button>)}
    </div>

    {loading ? <div className="rounded-2xl border border-[#e1e8f5] bg-white p-6 text-[#60749b]" role="status">Loading the library…</div> : error ? <div className="rounded-2xl border border-red-200 bg-white p-6" role="alert"><p className="text-[#142950]">{error}</p>{onRetry && <button className={`${libraryPrimaryButton} mt-4`} type="button" onClick={onRetry}>Try again</button>}</div> : visible.length ? <>
      <ul className="grid gap-5 md:grid-cols-2 lg:gap-6">{visible.map((article) => {
        const recommended = recommendedIds.has(article.id) || Boolean(article.recommendation);
        const initials = article.publisher === "AB Ignite Learning" ? "AB" : article.publisher.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
        return <li key={article.id}><article className={`flex h-full flex-col rounded-[26px] border border-[#e2e9f5] border-l-[3px] bg-white px-6 py-7 shadow-[0_8px_22px_rgba(35,64,124,0.07)] sm:px-8 ${recommended ? "border-l-[#e87b00]" : "border-l-[#245cff]"}`} aria-labelledby={`library-article-${article.id}`}>
          <div className="flex flex-wrap items-center gap-3"><span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#102e7c] font-serif text-lg font-bold text-white">{initials}</span><div className="min-w-0 flex-1"><p className="break-words font-semibold text-[#245cff]">{article.publisher}</p><p className="mt-0.5 break-words text-sm text-[#7184a7]">{librarySource(article)}</p></div>{recommended && <span className="rounded-full border border-[#f5bd77] px-3 py-1 text-xs font-semibold text-[#db7000]">✧ Recommended for you</span>}</div>
          <h2 id={`library-article-${article.id}`} className="mt-5 text-xl font-bold leading-snug text-[#142950]">{article.title}</h2>
          {article.summary && <p className="mt-3 flex-1 text-base leading-6 text-[#667b9e]">{article.summary}</p>}
          <div className="mt-5"><LibraryMetadata article={article} /></div>
          <div className="mt-4"><button className={libraryPrimaryButton} type="button" onClick={() => onRead(article)}>Read</button></div>
        </article></li>;
      })}</ul>
      {pageCount > 1 && <nav aria-label="Library pages" className="flex items-center justify-between gap-3 text-sm text-[#60749b]"><button className={libraryPrimaryButton} type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button className={libraryPrimaryButton} type="button" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)}>Next</button></nav>}
    </> : <div className="rounded-2xl border border-[#e1e8f5] bg-white p-6 text-[#60749b]" role="status">{filter === "recommended" ? "No recommended reading yet. Complete a quiz to get reading suggestions for your topic gaps." : "No published articles in this category yet."}</div>}
  </section>;
}
