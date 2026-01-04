"use client";

import { useEffect, useState } from "react";

type HealthBadge = "OK" | "DEGRADED" | "ERROR" | "LOADING";

interface HealthPayload {
  status?: "ok" | "degraded";
}

export default function HealthIndicator() {
  const [status, setStatus] = useState<HealthBadge>("LOADING");

  useEffect(() => {
    let cancelled = false;

    const loadHealth = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Health check failed");
        }

        const payload = (await response.json()) as HealthPayload;
        const healthStatus = payload.status ?? "degraded";

        if (cancelled) return;

        setStatus(healthStatus === "ok" ? "OK" : "DEGRADED");
      } catch (error) {
        if (!cancelled) {
          setStatus("ERROR");
        }
      }
    };

    loadHealth();
    const interval = setInterval(loadHealth, 5 * 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const color =
    status === "OK"
      ? "text-emerald-400"
      : status === "DEGRADED"
        ? "text-amber-300"
        : status === "ERROR"
          ? "text-rose-400"
          : "text-slate-500";

  const label =
    status === "OK"
      ? "OK"
      : status === "DEGRADED"
        ? "DEGRADED"
        : status === "ERROR"
          ? "UNAVAILABLE"
          : "CHECKING";

  return (
    <a
      className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide transition-colors ${color}`}
      href="/api/health"
      rel="noreferrer"
      target="_blank"
      aria-label={`API health status: ${label}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      <span className="tabular-nums min-w-[10rem] shrink-0 text-right">Health: {label}</span>
    </a>
  );
}
