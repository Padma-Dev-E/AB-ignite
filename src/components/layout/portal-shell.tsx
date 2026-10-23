import type { ReactNode } from "react";

export function PortalBrand({ className = "" }: { className?: string }) {
  return <div className={`flex items-center gap-2 ${className}`}>
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
      <defs><linearGradient id="portal-flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FBBF24" /><stop offset="1" stopColor="#F97316" /></linearGradient></defs>
      <path d="M12.6 2.5c3.6 3.9 6.4 7.2 6.4 11.3a7 7 0 0 1-14 0c0-2.8 1.3-5 3.1-6.7.1 2.4.9 3.7 2.2 3.9 1.3-2.1 2.3-5 2.3-8.5z" fill="url(#portal-flame)" />
      <path d="M12.3 12.6c1.7 1.9 3 3.5 3 5.4a3.3 3.3 0 0 1-6.6 0c0-1.3.6-2.4 1.5-3.2 0 1.1.4 1.7 1 1.9.6-1 1.1-2.4 1.1-4.1z" fill="#FDE68A" />
    </svg>
    <div className="brand-wordmark"><small>ARAB BANK</small><b>AB IGNITE</b></div>
  </div>;
}

export const portalSidebarClass = "fixed inset-y-0 left-0 z-50 flex w-[268px] -translate-x-[105%] flex-col gap-6 border-r p-[22px_14px] transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-[300px] lg:translate-x-0 lg:bg-white/60";
export const portalNavigationClass = "flex flex-col gap-0.5";
export const portalNavigationItemClass = "relative flex items-center gap-3 rounded-[10px] px-3 py-3 text-left font-normal transition";
export const portalHeaderClass = "sticky top-0 z-30 flex items-center gap-2 border-b bg-white/75 px-3 py-2.5 backdrop-blur-md sm:min-h-[82px] sm:px-7";

export function PortalTopBar({ children }: { children: ReactNode }) {
  return <header className={portalHeaderClass} style={{ borderColor: "var(--line)" }}>{children}</header>;
}
