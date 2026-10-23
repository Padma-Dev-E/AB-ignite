"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect, type ReactNode } from "react";

export type GlobalToastKind = "success" | "error";
export type GlobalToast = { id: number; kind: GlobalToastKind; message: string; durationMs: number };
export const MAX_GLOBAL_TOASTS = 3;

export function addGlobalToast(queue: GlobalToast[], toast: GlobalToast): GlobalToast[] {
  return [...queue, toast].slice(-MAX_GLOBAL_TOASTS);
}
export function dismissGlobalToast(queue: GlobalToast[], id: number): GlobalToast[] {
  return queue.filter((toast) => toast.id !== id);
}

type ToastActions = {
  success: (message: string, durationMs?: number) => number;
  error: (message: string, durationMs?: number) => number;
  dismiss: (id: number) => void;
};
const ToastContext = createContext<ToastActions | null>(null);

function ToastItem({ toast, dismiss }: { toast: GlobalToast; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss]);
  const error = toast.kind === "error";
  return <div role={error ? "alert" : "status"} className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${error ? "border-red-200 bg-red-50 text-red-950" : "border-blue-950 bg-blue-950 text-white"}`}>
    <span aria-hidden="true" className="mt-0.5 font-bold">{error ? "!" : "✓"}</span>
    <p className="min-w-0 flex-1 text-sm font-medium leading-6">{toast.message}</p>
    <button type="button" className={`min-h-9 min-w-9 rounded-md text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${error ? "hover:bg-black/5" : "hover:bg-white/10"}`} aria-label={`Dismiss ${toast.kind} message`} onClick={() => dismiss(toast.id)}>×</button>
  </div>;
}

export function GlobalToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<GlobalToast[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((queue) => dismissGlobalToast(queue, id)), []);
  const show = useCallback((kind: GlobalToastKind, message: string, durationMs = 5000) => {
    const id = ++nextId.current;
    const toast = { id, kind, message, durationMs: Math.max(1000, Math.min(15000, durationMs)) };
    setToasts((queue) => addGlobalToast(queue, toast));
    return id;
  }, []);
  const actions = useMemo<ToastActions>(() => ({ success: (message, durationMs) => show("success", message, durationMs), error: (message, durationMs) => show("error", message, durationMs), dismiss }), [show, dismiss]);
  return <ToastContext.Provider value={actions}>
    {children}
    {toasts.length > 0 && <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-col gap-2" aria-label="Notifications">
      {toasts.map((toast) => <div key={toast.id} className="pointer-events-auto"><ToastItem toast={toast} dismiss={dismiss} /></div>)}
    </div>}
  </ToastContext.Provider>;
}

export function useGlobalToast(): ToastActions {
  const actions = useContext(ToastContext);
  if (!actions) throw new Error("useGlobalToast must be used within GlobalToastProvider.");
  return actions;
}
