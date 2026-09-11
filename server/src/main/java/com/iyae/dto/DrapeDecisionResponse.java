package com.iyae.dto;

import java.time.Instant;

/**
 * Phase 4 前后对比(pre/post 部署)决策门:比较 Phase 1-3 垂坠改动上线前后的
 * 试穿→加购(TRYON_STARTED→ADD_TO_CART)聚合转化率。
 *
 * <p>{@code tryOnToCartRate} 是事件计数比({@code addToCart/tryOnStarted}),非 per-session
 * 转化(analytics_events 无 session id 可 join),与 KpiSummaryResponse 的
 * {@code conversionRate=ordersPaid/checkoutInitiated} 同为聚合比率口径。{@code zScore}/{@code pValue}
 * 为两比例检验的近似(比率可能 >1 时统计量做 clamp),用于方向性判断——决策门为人审,不自动触发 Phase 5。
 *
 * @param recommendation {@code "INVEST" | "STOP" | "INCONCLUSIVE"}
 */
public record DrapeDecisionResponse(
    Instant cutoff,
    FunnelWindow before,
    FunnelWindow after,
    double absoluteLift,   // after.rate - before.rate (百分点差)
    double relativeLift,   // (after.rate - before.rate) / before.rate
    double zScore,
    double pValue,
    boolean significant,   // pValue < 0.05
    String recommendation
) {
    /** 单个时间窗(部署前 / 部署后)的试穿→加购漏斗计数与比率。 */
    public record FunnelWindow(long tryOnStarted, long addToCart, double tryOnToCartRate) {}
}
