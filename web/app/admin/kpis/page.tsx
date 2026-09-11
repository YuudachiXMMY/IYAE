"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import {
  analytics,
  ApiError,
  type DrapeDecisionResponse,
  type KpiSummaryResponse,
} from "@/lib/api";
import { TONE_CLASS, type StatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

const RECOMMENDATION_TONE: Record<DrapeDecisionResponse["recommendation"], StatusTone> = {
  INVEST: "success",
  STOP: "destructive",
  INCONCLUSIVE: "warning",
};

const RECOMMENDATION_LABEL: Record<DrapeDecisionResponse["recommendation"], string> = {
  INVEST: "INVEST — 相对提升显著 ≥ +10%,值得投入布料仿真",
  STOP: "STOP — 转化显著下降,不投入布料仿真",
  INCONCLUSIVE: "INCONCLUSIVE — 未达显著,继续采集数据后再判",
};

function DecisionCard({ d }: { d: DrapeDecisionResponse }) {
  const tone = RECOMMENDATION_TONE[d.recommendation];
  return (
    <div className="rounded-card border border-border bg-card p-6 shadow-soft">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold text-foreground">Drape Decision Gate</h2>
        <span className="text-xs text-muted-foreground">cutoff: {d.cutoff}</span>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 font-medium"></th>
            <th className="py-1 font-medium">试穿数</th>
            <th className="py-1 font-medium">加购数</th>
            <th className="py-1 font-medium">试穿→加购率</th>
          </tr>
        </thead>
        <tbody className="text-foreground">
          <tr>
            <td className="py-1 text-muted-foreground">部署前 (before)</td>
            <td className="py-1">{d.before.tryOnStarted}</td>
            <td className="py-1">{d.before.addToCart}</td>
            <td className="py-1">{pct(d.before.tryOnToCartRate)}</td>
          </tr>
          <tr>
            <td className="py-1 text-muted-foreground">部署后 (after)</td>
            <td className="py-1">{d.after.tryOnStarted}</td>
            <td className="py-1">{d.after.addToCart}</td>
            <td className="py-1">{pct(d.after.tryOnToCartRate)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-foreground">
        <span>
          绝对 lift <strong>{(d.absoluteLift * 100).toFixed(1)}pp</strong>
        </span>
        <span>
          相对 lift <strong>{pct(d.relativeLift)}</strong>
        </span>
        <span>z = {d.zScore.toFixed(2)}</span>
        <span>p = {d.pValue.toFixed(4)}</span>
        <span>{d.significant ? "✅ 显著 (p<0.05)" : "— 不显著"}</span>
      </div>

      <div
        className={cn(
          "mt-5 rounded-button px-4 py-3 text-sm font-medium",
          TONE_CLASS[tone],
        )}
      >
        建议:{RECOMMENDATION_LABEL[d.recommendation]}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        前后对比(pre/post 部署)口径:试穿→加购为聚合事件比率(addToCart/tryOnStarted),非 per-session
        转化;z/p 为两比例检验近似。决策为人审,不自动触发布料仿真。
      </p>
    </div>
  );
}

function CohortTable({ kpis }: { kpis: KpiSummaryResponse }) {
  if (kpis.cohorts.length === 0) return null;
  return (
    <div className="mt-8 rounded-card border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-xl font-semibold text-foreground">Per-cohort KPIs</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-medium">Cohort</th>
              <th className="py-1 font-medium">Views</th>
              <th className="py-1 font-medium">Try-on</th>
              <th className="py-1 font-medium">Add-to-cart</th>
              <th className="py-1 font-medium">Checkout</th>
              <th className="py-1 font-medium">Paid</th>
              <th className="py-1 font-medium">Returned</th>
              <th className="py-1 font-medium">Conv.</th>
              <th className="py-1 font-medium">Return</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {kpis.cohorts.map((c) => (
              <tr key={c.cohort} className="border-t border-border">
                <td className="py-1 font-medium">{c.cohort}</td>
                <td className="py-1">{c.views}</td>
                <td className="py-1">{c.tryOnStarted}</td>
                <td className="py-1">{c.addToCart}</td>
                <td className="py-1">{c.checkoutInitiated}</td>
                <td className="py-1">{c.ordersPaid}</td>
                <td className="py-1">{c.ordersReturned}</td>
                <td className="py-1">{pct(c.conversionRate)}</td>
                <td className="py-1">{pct(c.returnRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpisDashboard() {
  const [decision, setDecision] = useState<DrapeDecisionResponse | null>(null);
  const [kpis, setKpis] = useState<KpiSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Async body — no synchronous setState in the effect (initial state is loading=true).
    (async () => {
      try {
        const [d, k] = await Promise.all([
          analytics.drapeDecision().catch((e: unknown) => {
            // A 400 here means cutoff isn't configured — surface a hint, keep KPIs.
            if (e instanceof ApiError && e.status === 400) return null;
            throw e;
          }),
          analytics.kpis(),
        ]);
        if (cancelled) return;
        setDecision(d);
        setKpis(k);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Failed to load KPIs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-card bg-muted" />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-button bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {decision ? (
        <DecisionCard d={decision} />
      ) : (
        !error && (
          <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
            未配置 drape 部署 cutoff。设置 <code>ANALYTICS_DRAPE_DEPLOY_CUTOFF</code>(ISO-8601 instant)
            或以 <code>?cutoff=</code> 调用端点后即可看到前后对比决策卡。
          </div>
        )
      )}
      {kpis && <CohortTable kpis={kpis} />}
    </div>
  );
}

export default function AdminKpisPage() {
  const { user, loading } = useRequireAuth("ADMIN");

  if (loading || !user || user.role !== "ADMIN") {
    return (
      <>
        <SiteHeader variant="app" />
        <PageShell>
          <div className="h-40 animate-pulse rounded-card bg-muted" />
        </PageShell>
      </>
    );
  }

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <div className="mb-8">
          <h1 className="font-display text-4xl font-semibold text-foreground md:text-5xl">
            Conversion KPIs
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            垂坠改动(Phase 1-3)前后对比的试穿→加购转化决策门。
          </p>
        </div>
        <KpisDashboard />
      </PageShell>
    </>
  );
}
