"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { PortalBrand, PortalTopBar, portalNavigationClass, portalNavigationItemClass, portalSidebarClass } from "../../../components/layout/portal-shell";

export const adminNavigation = [
  { id: "dashboard", label: "Dashboard" }, { id: "ideas", label: "Ideas" },
  { id: "delivery", label: "POCs and delivery" },
  { id: "feedback", label: "Demo Feedback" }, { id: "learning", label: "Learning Content Management" },
  { id: "challenges", label: "Challenges" }, { id: "announcements", label: "Announcements" },
  { id: "rewards", label: "Rewards" },
  { id: "users", label: "Users" },
  { id: "settings", label: "Workflow settings" }, { id: "audit", label: "Audit trail" },
] as const;
export type AdminView = (typeof adminNavigation)[number]["id"];

export function visibleAdminViews(role?: string): AdminView[] {
  if (role === "back_office") return adminNavigation.map(item => item.id);
  if (role === "business_owner") return ["ideas"];
  return [];
}

export function AdminShell({ email, name, role, views, active, onNavigate, children }: { email: string; name?: string | null; role?: string; views: AdminView[]; active: AdminView; onNavigate: (view: AdminView) => void; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = adminNavigation.find(item => item.id === active)?.label ?? "Back office";
  async function leave() {
    try { await fetch("/api/auth/refresh", { method: "DELETE", credentials: "same-origin" }); }
    finally { await signOut({ callbackUrl: "/login" }); }
  }
  const navigation = <nav aria-label="Back office navigation" className={portalNavigationClass}>{adminNavigation.filter(item => views.includes(item.id)).map(item => <button key={item.id} type="button" aria-current={active === item.id ? "page" : undefined} onClick={() => { onNavigate(item.id); setMobileOpen(false); }} className={`${portalNavigationItemClass} ${active === item.id ? "bg-gradient-to-r from-blue/20 to-transparent font-medium text-ink before:absolute before:bottom-[9px] before:left-0 before:top-[9px] before:w-[3px] before:rounded-sm before:bg-blue" : "text-muted hover:bg-[var(--hover)] hover:text-ink"}`}>{item.label}</button>)}</nav>;
  const footer = <div className="mt-auto rounded-[14px] border p-3.5 text-[12.5px] text-muted" style={{ borderColor: "var(--line)" }}>
    {(role === "back_office" || role === "business_owner") && <div className="mb-3"><b className="font-medium text-ink">Employee app</b><Link href="/private" className="mt-1 block font-medium text-blue" onClick={() => setMobileOpen(false)}>{role === "business_owner" ? "Return to employee portal" : "Open the employee portal"}</Link></div>}
    <p className="font-medium text-ink">{name || email}</p><p>{role?.replaceAll("_", " ")}</p><button type="button" className="mt-2 block text-blue" onClick={() => void leave()}>Sign out</button>
  </div>;
  return <main className="min-h-screen bg-[var(--app-bg,#f8faff)] text-[var(--text)] lg:flex">
    {mobileOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-[#10233d]/35 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside className={`${portalSidebarClass} border-[var(--line)] bg-white/90 backdrop-blur-md lg:bg-white/60 ${mobileOpen ? "translate-x-0" : ""}`}>
      <div className="px-2"><PortalBrand /><p className="mt-2 text-sm text-muted">{role === "business_owner" ? "Business owner workspace" : "Back office"}</p></div>{navigation}{footer}
    </aside>
    <div className="flex min-h-screen min-w-0 flex-1 flex-col">
      <PortalTopBar><button type="button" className="icon-button lg:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen(value => !value)}><span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span></button><h2 className="mr-auto min-w-0 truncate text-[15px] font-medium before:mr-2.5 before:inline-block before:h-2.5 before:w-2.5 before:rounded-full before:bg-blue sm:text-base">{title}</h2><span className="hidden max-w-[45%] truncate text-sm text-muted sm:block" title={email}>{email}</span></PortalTopBar>
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</div>
    </div>
  </main>;
}
