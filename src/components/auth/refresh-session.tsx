"use client";

import { useEffect } from "react";
import { refreshSession } from "../../auth/client-refresh";

export function RefreshSession() {
  useEffect(() => {
    const configuredSeconds = Number(
      process.env.NEXT_PUBLIC_AUTH_REFRESH_INTERVAL_SECONDS ?? 600,
    );
    const intervalMs = Math.max(
      60_000,
      (Number.isFinite(configuredSeconds) ? configuredSeconds : 600) * 1000,
    );

    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      void refreshSession();
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
