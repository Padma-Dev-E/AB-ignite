"use client";

import React from "react";
import { AdminPagination } from "./admin-data-ui";

/** Numbered pagination for cursor-backed people and session lists. */
export type PeoplePaginationProps = {
  label: string;
  page: number;
  loadedPages: number;
  hasNext: boolean;
  busy?: boolean;
  onPageChange: (page: number) => void;
};

export function PeoplePagination({ label, page, loadedPages, hasNext, busy = false, onPageChange }: PeoplePaginationProps) {
  // Cursor APIs expose no total. A single sentinel row exposes the next page
  // until the server confirms there is no next cursor.
  const total = (loadedPages + (hasNext ? 1 : 0)) * 10;
  return <AdminPagination label={label} page={page} pageSize={10} total={total} busy={busy} onPageChange={onPageChange} />;
}
