"use client";

import { useEffect } from "react";

export function RefreshSession() {
  useEffect(() => {
    const configuredSeconds = Number(process.env.NEXT_PUBLIC_AUTH_REFRESH_INTERVAL_SECONDS ?? 600);
    const intervalMs = Math.max(60_000, (Number.isFinite(configuredSeconds) ? configuredSeconds : 600) * 1000);

    const refresh = () => {
      void fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
    };

    const interval = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return null;
}
