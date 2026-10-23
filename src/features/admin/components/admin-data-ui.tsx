"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import type { ReactNode } from "react";

export function AdminDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "wide",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "wide" | "narrow";
}) {
  return <Dialog open={open} onClose={onClose} className="relative z-50">
    <div className="fixed inset-0 bg-[#10233d]/35 backdrop-blur-[1px]" aria-hidden="true" />
    <DialogPanel className={`fixed inset-y-0 right-0 flex h-full w-full flex-col border-l border-[var(--line)] bg-white shadow-2xl ${width === "narrow" ? "sm:max-w-lg" : "sm:max-w-2xl"}`}>
      <header className="shrink-0 border-b border-[var(--line)] bg-white px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><DialogTitle className="text-xl font-semibold tracking-tight text-[var(--text)]">{title}</DialogTitle>{description && <p className="mt-1 text-sm leading-5 text-muted">{description}</p>}</div>
          <button type="button" aria-label="Close details" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--line)] text-lg text-muted hover:bg-[#f4f7fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1762a7]">×</button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
      {footer && <footer className="shrink-0 border-t border-[var(--line)] bg-white px-5 py-4 sm:px-7">{footer}</footer>}
    </DialogPanel>
  </Dialog>;
}

export function AdminPagination({
  page,
  pageSize,
  total,
  onPageChange,
  busy = false,
  label = "Records",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  busy?: boolean;
  label?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const first = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, total);
  const start = Math.max(1, Math.min(current - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const buttonClass = "grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1762a7] disabled:cursor-not-allowed disabled:opacity-45";

  return <nav aria-label={`${label} pagination`} className="flex flex-col gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-muted" aria-live="polite">Showing <span className="font-medium text-[var(--text)]">{first}–{last}</span> of <span className="font-medium text-[var(--text)]">{total}</span> · Page {current} of {pageCount}</p>
    <div className="flex items-center gap-1.5">
      <button type="button" className={buttonClass} aria-label="Previous page" disabled={busy || current <= 1} onClick={() => onPageChange(current - 1)}>‹</button>
      {start > 1 && <><button type="button" className={buttonClass} onClick={() => onPageChange(1)}>1</button>{start > 2 && <span className="px-1 text-muted" aria-hidden="true">…</span>}</>}
      {pages.map(number => <button key={number} type="button" aria-current={number === current ? "page" : undefined} className={`${buttonClass} ${number === current ? "border-[#1762a7] bg-[#1762a7] font-semibold text-white" : "border-[var(--line)] bg-white text-[var(--text)] hover:bg-[#f4f7fb]"}`} disabled={busy} onClick={() => onPageChange(number)}>{number}</button>)}
      {end < pageCount && <><span className="px-1 text-muted" aria-hidden="true">…</span><button type="button" className={buttonClass} onClick={() => onPageChange(pageCount)}>{pageCount}</button></>}
      <button type="button" className={buttonClass} aria-label="Next page" disabled={busy || current >= pageCount} onClick={() => onPageChange(current + 1)}>›</button>
    </div>
  </nav>;
}
