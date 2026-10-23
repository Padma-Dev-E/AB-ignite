"use client";

import { useEffect, useRef } from "react";

export function RefreshSession() {
  const inFlight = useRef<Promise<Response> | null>(null);
  useEffect(() => {
    const configuredSeconds = Number(
      process.env.NEXT_PUBLIC_AUTH_REFRESH_INTERVAL_SECONDS ?? 600,
    );
    const intervalMs = Math.max(
      60_000,
      (Number.isFinite(configuredSeconds) ? configuredSeconds : 600) * 1000,
    );

    const refresh = () => {
      if (document.visibilityState === "hidden" || inFlight.current) return;
      inFlight.current = fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
      })
        .catch(() => new Response(null, { status: 0 }))
        .finally(() => {
          inFlight.current = null;
        });
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
