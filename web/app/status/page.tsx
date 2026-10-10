"use client";

import { useState, useEffect, useCallback } from "react";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { api } from "@/lib/api";
import { BRAND } from "@/lib/brand";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthResponse {
  status: string;
  service?: string;
}

interface AiHealthResponse {
  status: string;
  provider?: string;
}

type ServiceStatus = "loading" | "up" | "down";

// ── Status Indicator ──────────────────────────────────────────────────────────

function StatusIndicator({
  status,
  label,
  detail,
}: {
  status: ServiceStatus;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-card bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <div
          className={`h-3 w-3 rounded-full ${
            status === "loading"
              ? "animate-pulse bg-muted-foreground/40"
              : status === "up"
                ? "bg-success"
                : "bg-destructive"
          }`}
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          status === "loading"
            ? "bg-muted text-muted-foreground"
            : status === "up"
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
        }`}
      >
        {status === "loading"
          ? "Checking..."
          : status === "up"
            ? "Operational"
            : "Down"}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StatusPage() {
  const [apiStatus, setApiStatus] = useState<ServiceStatus>("loading");
  const [aiStatus, setAiStatus] = useState<ServiceStatus>("loading");
  const [apiDetail, setApiDetail] = useState<string | undefined>(undefined);
  const [aiDetail, setAiDetail] = useState<string | undefined>(undefined);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const probeHealth = useCallback(() => {
    api
      .get<HealthResponse>("/api/health")
      .then((res) => {
        setApiStatus(res.status?.toUpperCase() === "UP" ? "up" : "down");
        setApiDetail(res.service);
      })
      .catch(() => setApiStatus("down"));

    api
      .get<AiHealthResponse>("/api/health/ai")
      .then((res) => {
        const s = res.status?.toUpperCase();
        setAiStatus(s === "DOWN" || s === "ERROR" ? "down" : "up");
        setAiDetail(
          res.provider ? `Provider: ${res.provider}` : undefined,
        );
      })
      .catch(() => setAiStatus("down"))
      .finally(() => setCheckedAt(new Date()));
  }, []);

  // Refresh re-arms the indicators first; on mount they are already in that
  // state, so the effect only has to fire the probes.
  const checkHealth = useCallback(() => {
    setApiStatus("loading");
    setAiStatus("loading");
    setCheckedAt(null);
    probeHealth();
  }, [probeHealth]);

  useEffect(() => {
    probeHealth();
  }, [probeHealth]);

  const allUp = apiStatus === "up" && aiStatus === "up";
  const anyLoading = apiStatus === "loading" || aiStatus === "loading";

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <div className="mx-auto max-w-lg">
          <div className="mb-8">
            <h1 className="font-display text-4xl font-semibold text-foreground">
              System Status
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Real-time status of {BRAND.name} services.
            </p>
          </div>

          {!anyLoading && (
            <div
              className={`mb-6 rounded-card px-5 py-4 ${
                allUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              }`}
            >
              <p className="text-sm font-semibold">
                {allUp
                  ? "All systems operational"
                  : "One or more services are experiencing issues"}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <StatusIndicator
              status={apiStatus}
              label="API"
              detail={apiDetail}
            />
            <StatusIndicator
              status={aiStatus}
              label="AI Service"
              detail={aiDetail}
            />
          </div>

          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            {checkedAt ? (
              <p>
                Last checked:{" "}
                {checkedAt.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            ) : (
              <p>Checking services...</p>
            )}
            <button
              onClick={checkHealth}
              disabled={anyLoading}
              className="text-brand hover:underline disabled:opacity-40"
            >
              Refresh
            </button>
          </div>
        </div>
      </PageShell>
      <Footer />
    </>
  );
}
