import React from "react";
import type { LearningArticle } from "../types";

export const libraryCategories = [
  { id: "all", label: "All" },
  { id: "recommended", label: "Recommended" },
  { id: "banking", label: "Banking Excellence" },
  { id: "transformation", label: "Innovation & Business Transformation" },
  { id: "technology", label: "Technology & AI" },
] as const;

export type LibraryFilter = (typeof libraryCategories)[number]["id"];

const categoryLabels: Record<string, string> = {
  banking: "Banking Excellence",
  transformation: "Innovation & Business Transformation",
  technology: "Technology & AI",
};

export function libraryCategoryLabel(category: string) {
  return categoryLabels[category] ?? category.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function libraryTopicLabel(topic: string | null) {
  return topic?.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? "";
}

export function librarySource(article: LearningArticle) {
  if (article.contentType === "internal") return "In-app reading";
  const url = librarySourceUrl(article);
  return url ? new URL(url).hostname : "Source unavailable";
}

export function librarySourceUrl(article: LearningArticle) {
  if (article.contentType !== "external" || !article.sourceUrl) return null;
  try {
    const url = new URL(article.sourceUrl);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export const libraryPrimaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#245cff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1749db] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245cff] disabled:cursor-not-allowed disabled:opacity-60";
export const librarySecondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cbd8f2] bg-white px-5 py-2.5 text-sm font-semibold text-[#142950] hover:bg-[#f5f8ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245cff] disabled:cursor-not-allowed disabled:opacity-60";

export function LibraryMetadata({ article, readLabel = false }: { article: LearningArticle; readLabel?: boolean }) {
  return <div className="flex flex-wrap items-center gap-2 text-sm text-[#64799f]">
    <span className="rounded-full border border-[#ccdaf2] bg-white px-3 py-1 font-medium leading-5">{libraryCategoryLabel(article.category)}</span>
    <span className="rounded-full border border-[#a9bfff] bg-white px-3 py-1 font-medium capitalize leading-5 text-[#245cff]">{article.difficulty}</span>
    <span className="inline-flex items-center gap-1.5 leading-5"><svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5"/><path d="M10 5.75V10l3 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{article.readingMinutes} min{readLabel ? " read" : ""}{article.topic ? ` · ${libraryTopicLabel(article.topic)}` : ""}</span>
  </div>;
}
