# Plan: 3D 试穿垂坠真实感 — Phase 4 转化验证与决策门

## Summary
Phase 1-3 已把"贴纸/悬浮/塑料/穿模"观感修复上线(材质恢复、接触阴影、PBR/法线贴图、几何 push-out)。Phase 4 不再改渲染,而是**用 Phase 0 建好的埋点漏斗量化这批改动对"试穿→加购"转化的影响**,并产出一个数据驱动的决策门("投入布料仿真 / 到此为止")。方法为**前后对比(pre/post 部署)**:以一个可配置的部署 cutoff 时间戳切分 `analytics_events`,计算部署前 vs 部署后的试穿→加购转化率、lift 与两比例 z 检验显著性,通过一个新的 ADMIN 端点 + web admin 面板展示,并写入一份可填充的决策报告。

## User Story
作为 **IYAE 的产品/增长负责人**,我想 **在一个 admin 面板上看到 Phase 1-3 垂坠改动前后"试穿→加购"转化率的变化、提升幅度与统计显著性**,以便 **用数据决定是否值得投入高成本的离线布料仿真(Phase 5),而不是凭感觉**。

## Problem → Solution
**现状**:埋点漏斗(VIEW/TRYON_STARTED/ADD_TO_CART/CHECKOUT_INITIATED/ORDER_PAID/ORDER_RETURNED)与 cohort 基建已就绪,但 `kpisByCohort()` 只算了 `conversion = ordersPaid/checkoutInitiated`,**没有 PRD 主指标"试穿→加购"转化率、没有前后对比、没有 lift/显著性、没有任何 web 展示面**。决策门无从判断。
**目标**:新增一个前后对比的决策端点 + web 面板 + 决策报告,把"试穿→加购转化在 Phase 1-3 上线后是否统计显著提升 ≥ +10%"变成可读、可复现的结论。

## Metadata
- **Complexity**: Large(server + web + 统计 + 文档,~11 个文件)
- **Source PRD**: `.claude/PRPs/prds/3d-tryon-garment-drape-realism.prd.md`
- **PRD Phase**: Phase 4 — 转化验证与决策门(depends 1,2,3 — 均 complete)
- **Estimated Files**: 11(server 6 改 + web 3 改 + 1 决策文档 + 1 PRD 状态更新)

---

## UX Design

### Before
```
┌──────────────────────────────────────────────┐
│  /api/admin/kpis 端点存在,但无任何前端消费者   │
│  管理员只能 curl 看到 per-cohort 原始计数       │
│  + conversion(paid/initiated) —— 看不到         │
│  "试穿→加购"主指标,更没有前后对比/lift/显著性  │
└──────────────────────────────────────────────┘
```

### After
```
┌──────────────────────────────────────────────────────────┐
│  /admin/kpis  (ADMIN-gated 页面)                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Drape Decision Gate            cutoff: 2026-09-10   │  │
│  │                                                      │  │
│  │              试穿数   加购数   试穿→加购率            │  │
│  │  部署前(before) 1,240   210     16.9%               │  │
│  │  部署后(after)  1,880   402     21.4%               │  │
│  │                                                      │  │
│  │  绝对 lift +4.5pp   相对 lift +26.6%                 │  │
│  │  z=3.12  p=0.0018   ✅ 显著 (p<0.05)                 │  │
│  │                                                      │  │
│  │   ┌───────────────────────────────────────────┐    │  │
│  │   │  建议: INVEST — 相对提升 ≥ +10% 且显著       │    │  │
│  │   └───────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────┘  │
│  (下方复用现有 kpisByCohort 的 per-cohort 明细表)          │
└──────────────────────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Admin 查看转化 | 无 UI,只能 curl `/api/admin/kpis` | `/admin/kpis` 面板展示前后对比 + 决策建议 | 复用 `useRequireAuth("ADMIN")` 门控 |
| 主指标可读性 | 只有 paid/initiated | 新增 试穿→加购率 + lift + z/p + 建议 | PRD 主指标首次可测 |
| cutoff 时间窗 | N/A | 端点接受 `?cutoff=<ISO>`,默认取配置值 | 可调窗做敏感性分析 |
| 决策记录 | 无 | 决策报告文档(可填充结论) | 门是人审的,非自动触发 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `server/src/main/java/com/iyae/service/AnalyticsService.java` | 全文(1-130) | 要在此加 `drapeDecision()`;镜像 `kpisByCohort` 聚合风格 + best-effort/`@Transactional(readOnly)` |
| P0 | `server/src/main/java/com/iyae/repository/AnalyticsEventRepository.java` | 全文(1-30) | 加派生 count 查询;镜像 `countByEventType` 命名 |
| P0 | `server/src/main/java/com/iyae/controller/AnalyticsController.java` | 全文(1-51) | 加 `/api/admin/kpis/drape-decision`;镜像 `kpis()` 的 ADMIN URL 门控注释 |
| P0 | `server/src/main/java/com/iyae/config/AnalyticsProperties.java` | 全文 | 加 `drapeDeployCutoff` 字段;record 紧凑构造器补默认值 |
| P0 | `server/src/main/java/com/iyae/dto/KpiSummaryResponse.java` | 全文 | 镜像嵌套 record DTO 风格,新建 `DrapeDecisionResponse` |
| P0 | `web/app/admin/page.tsx` | 1-60, 495-540 | ADMIN 门控 + `SiteHeader`/`PageShell` + `useRequireAuth("ADMIN")` + `user.role!=="ADMIN"` 兜底渲染 |
| P0 | `web/lib/api.ts` | 60-84(analytics), 406(admin), 543(adminReports) | 镜像 `export const analytics` + admin getter 风格加 `drapeDecision()`/`kpis()` |
| P1 | `server/src/test/java/com/iyae/service/AnalyticsServiceTest.java` | 全文 | 镜像 `service(boolean)` 工厂 + Mockito 存根 + `kpisByCohort_computesConversionRate` 断言风格 |
| P1 | `server/src/test/java/com/iyae/controller/AnalyticsControllerTest.java` | 全文 | 镜像 `@WebMvcTest` + `WithMockUser(roles="ADMIN")` + `kpis_asDesigner_returns403` |
| P1 | `server/src/main/resources/application.yml` | 64-67 | `app.analytics.*` 配置块,加 `drape-deploy-cutoff` |
| P2 | `web/app/products/[id]/page.tsx` | 145-230 | `track({type:"VIEW"/"ADD_TO_CART"})` 埋点位置(理解数据来源;无需改) |
| P2 | `web/components/AvatarViewer.tsx` | 255-270 | `TRYON_STARTED` fire-once 埋点(理解主指标分子/分母来源;无需改) |
| P2 | `web/__tests__/lib/api.test.ts` | 全文 | 镜像 api 客户端 getter 的测试断言风格 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| 两比例 z 检验 | 标准统计(已知) | pooled proportion `p̂=(x1+x2)/(n1+n2)`;`SE=sqrt(p̂(1-p̂)(1/n1+1/n2))`;`z=(p2-p1)/SE`;双尾 `p=2(1-Φ(|z|))` |
| 正态 CDF 近似 | Abramowitz & Stegun 7.1.26(已知) | 无 commons-math 依赖 → 用 erf 有理逼近内联实现,零新依赖(镜像 worker/server "no new dep" 约定) |

> KEY_INSIGHT: server `build.gradle` **无** commons-math / 任何统计库 → 必须内联实现正态 CDF。APPLIES_TO: `AnalyticsService` 统计辅助方法。GOTCHA: 不要新增依赖。

---

## Patterns to Mirror

### NAMING_CONVENTION — 派生 count 查询
// SOURCE: server/src/main/java/com/iyae/repository/AnalyticsEventRepository.java:12
```java
long countByEventType(EventType eventType);
```
→ 新增遵循 Spring Data 派生命名:`countByEventTypeAndCreatedAtBefore(...)`、`countByEventTypeAndCreatedAtGreaterThanEqual(...)`。

### DTO_PATTERN — 嵌套 record + Javadoc
// SOURCE: server/src/main/java/com/iyae/dto/KpiSummaryResponse.java:9-38
```java
public record KpiSummaryResponse(
    List<CohortKpi> cohorts,
    List<SizeBracketKpi> sizeBrackets
) {
    public record CohortKpi(
        String cohort, long views, long tryOnStarted, long addToCart,
        long checkoutInitiated, long ordersPaid, long ordersReturned,
        double conversionRate, double returnRate
    ) {}
}
```

### SERVICE_PATTERN — 聚合比率 + 只读事务(要镜像的核心)
// SOURCE: server/src/main/java/com/iyae/service/AnalyticsService.java:92-120
```java
@Transactional(readOnly = true)
public KpiSummaryResponse kpisByCohort() {
    ...
    double conversion = initiated > 0 ? (double) paid / initiated : 0.0;
    double returnRate = paid > 0 ? (double) returned / paid : 0.0;
    ...
}
```
→ `drapeDecision` 同样用 `count > 0 ? (double) x / n : 0.0` 的守卫比率,分母为 0 时返回 0.0,绝不除零。

### CONFIG_PATTERN — record 紧凑构造器补默认
// SOURCE: server/src/main/java/com/iyae/config/AnalyticsProperties.java
```java
@ConfigurationProperties("app.analytics")
public record AnalyticsProperties(boolean enabled, List<String> cohorts) {
    public AnalyticsProperties {
        cohorts = (cohorts == null || cohorts.isEmpty()) ? List.of("control", "variant") : cohorts;
    }
}
```

### CONTROLLER_PATTERN — ADMIN URL 门控(不加方法级 @PreAuthorize)
// SOURCE: server/src/main/java/com/iyae/controller/AnalyticsController.java:40-50
```java
/**
 * ADMIN-only: the {@code /api/admin/**} rule in SecurityConfig maps this path to
 * hasRole("ADMIN"), so a DESIGNER/BUYER token is rejected with 403. No method-level
 * @PreAuthorize — the URL rule is authoritative.
 */
@GetMapping("/api/admin/kpis")
public ResponseEntity<KpiSummaryResponse> kpis() {
    return ResponseEntity.status(HttpStatus.OK).body(analyticsService.kpisByCohort());
}
```
→ 新端点路径必须以 `/api/admin/` 开头,自动被 `SecurityConfig.java:51` 的 `hasRole("ADMIN")` 覆盖。

### WEB_ADMIN_GATE — 页面门控 + 兜底渲染
// SOURCE: web/app/admin/page.tsx:500-512
```tsx
const { user, loading } = useRequireAuth("ADMIN");
if (loading || !user || user.role !== "ADMIN") {
  return (<><SiteHeader variant="app" /><PageShell>
    <div className="h-40 animate-pulse rounded-card bg-muted" /></PageShell></>);
}
```

### WEB_API_GETTER — analytics 客户端
// SOURCE: web/lib/api.ts:78-86
```ts
export const analytics = {
  track: (payload: TrackEventPayload): void => {
    void api.post("/api/events", payload).catch(() => { /* swallow */ });
  },
};
```
→ 加 `kpis: () => api.get<KpiSummaryResponse>("/api/admin/kpis")` 与 `drapeDecision: (cutoff?) => api.get<DrapeDecisionResponse>(path)`(注意:这些**会 throw ApiError**,不是 fire-and-forget;放在同一 `analytics` 对象但语义不同,加注释)。

### TEST_STRUCTURE — service 单测工厂
// SOURCE: server/src/test/java/com/iyae/service/AnalyticsServiceTest.java:29-33, 99-121
```java
private AnalyticsService service(boolean enabled) {
    return new AnalyticsService(eventRepository, cohortRepository,
            new AnalyticsProperties(enabled, List.of("control", "variant")));
}
// ...
when(eventRepository.countByCohortAndEventType()).thenReturn(List.of(
    new Object[]{"control", EventType.TRYON_STARTED, 4L}, ...));
KpiSummaryResponse summary = service.kpisByCohort();
assertThat(control.conversionRate()).isEqualTo(0.5);
```

### TEST_STRUCTURE — controller WebMvcTest + 角色
// SOURCE: server/src/test/java/com/iyae/controller/AnalyticsControllerTest.java:104-118
```java
@Test @WithMockUser(username="admin@example.com", roles="ADMIN")
void kpis_asAdmin_returns200() throws Exception {
    when(analyticsService.kpisByCohort()).thenReturn(new KpiSummaryResponse(List.of(), List.of()));
    mockMvc.perform(get("/api/admin/kpis")).andExpect(status().isOk());
}
@Test @WithMockUser(username="designer@example.com", roles="DESIGNER")
void kpis_asDesigner_returns403() throws Exception { ... }
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `server/src/main/java/com/iyae/repository/AnalyticsEventRepository.java` | UPDATE | 加两条派生 count 查询(cutoff 前/后 × eventType) |
| `server/src/main/java/com/iyae/dto/DrapeDecisionResponse.java` | CREATE | 前后对比 + lift + z/p + 建议的响应 record |
| `server/src/main/java/com/iyae/config/AnalyticsProperties.java` | UPDATE | 加 `drapeDeployCutoff`(ISO instant 字符串,可空) |
| `server/src/main/java/com/iyae/service/AnalyticsService.java` | UPDATE | 加 `drapeDecision(Instant)` + 两比例 z 检验 + 正态 CDF 辅助 |
| `server/src/main/java/com/iyae/controller/AnalyticsController.java` | UPDATE | 加 `GET /api/admin/kpis/drape-decision?cutoff=` |
| `server/src/main/resources/application.yml` | UPDATE | 加 `drape-deploy-cutoff: ${ANALYTICS_DRAPE_DEPLOY_CUTOFF:}` |
| `server/src/test/java/com/iyae/service/AnalyticsServiceTest.java` | UPDATE | drapeDecision 计算/显著性/边界(零分母、无 cutoff)测试 |
| `server/src/test/java/com/iyae/controller/AnalyticsControllerTest.java` | UPDATE | 新端点 200(admin)/403(designer)/cutoff 解析 |
| `web/lib/api.ts` | UPDATE | 加 `DrapeDecisionResponse`/`FunnelWindow`/`KpiSummaryResponse`/`CohortKpi` 类型 + `analytics.drapeDecision()`/`analytics.kpis()` |
| `web/app/admin/kpis/page.tsx` | CREATE | ADMIN-gated 决策面板 |
| `web/__tests__/lib/api.test.ts` | UPDATE | `analytics.drapeDecision()`/`kpis()` getter 断言 |
| `.claude/PRPs/reports/3d-tryon-drape-realism-phase4-conversion-decision-gate-report.md` | CREATE | 决策门方法学 + 复现步骤 + 可填充结论 |
| `.claude/PRPs/prds/3d-tryon-garment-drape-realism.prd.md` | UPDATE | Phase 4 状态 pending→in-progress + 挂 plan 链接 |

## NOT Building

- **cohort 门控渲染 / 并发 A/B** —— worker 已把材质/PBR/push-out 烘焙进 GLB,渲染时无法按用户回退到"旧渲染";前后对比是本阶段选定方法(用户已确认)。
- **per-session 级 试穿→加购 join** —— `analytics_events` 无 session id 关联 TRYON_STARTED 与 ADD_TO_CART;主指标采用**聚合事件比率**(与现有 `conversionRate=paid/initiated` 同风格),并在文档标注这是近似、决策门为人审。
- **穿模率 / 无纹理占比基线的自动采集** —— 属 Phase 0 收尾(部署 + 真人 QA),不在 Phase 4。
- **退货率长期指标看板** —— 60-90 天滞后指标,超出本阶段窗口。
- **自动触发 Phase 5** —— 决策是数据 + 人审,不自动开工布料仿真。
- **新增图表库 / 可视化依赖** —— 面板用纯数字 + 现有 shadcn/ui,不引入 charting 库。
- **写库路径改动 / 新 Flyway 迁移** —— 复用现有 `analytics_events`(已含 `created_at`/`cohort`),无 schema 变更。

---

## Step-by-Step Tasks

### Task 1: 仓库层加前后对比 count 查询
- **ACTION**: 在 `AnalyticsEventRepository` 加两条派生查询。
- **IMPLEMENT**:
  ```java
  long countByEventTypeAndCreatedAtBefore(EventType eventType, Instant cutoff);
  long countByEventTypeAndCreatedAtGreaterThanEqual(EventType eventType, Instant cutoff);
  ```
  同时 `import java.time.Instant;`
- **MIRROR**: NAMING_CONVENTION(`countByEventType`)。
- **IMPORTS**: `java.time.Instant`(已 import `EventType`)。
- **GOTCHA**: 边界用半开区间——`before` 用 `<cutoff`,`after` 用 `>=cutoff`,确保 cutoff 时刻的事件恰好归入 after,不重不漏。
- **VALIDATE**: `cd server && ./gradlew compileJava` 通过;方法名被 Spring Data 解析(无 `PropertyReferenceException`,`createdAt` 是 `AnalyticsEvent` 字段)。

### Task 2: 新建 DrapeDecisionResponse DTO
- **ACTION**: 创建 `server/src/main/java/com/iyae/dto/DrapeDecisionResponse.java`。
- **IMPLEMENT**:
  ```java
  package com.iyae.dto;
  import java.time.Instant;
  /**
   * 前后对比(pre/post 部署)决策门:比较 Phase 1-3 垂坠改动上线前后的
   * 试穿→加购(TRYON_STARTED→ADD_TO_CART)聚合转化率。
   * tryOnToCartRate 是事件计数比(addToCart/tryOnStarted),非 per-session 转化
   * (无 session id 可 join);z/p 为两比例检验近似,决策门为人审。
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
      String recommendation  // "INVEST" | "STOP" | "INCONCLUSIVE"
  ) {
      public record FunnelWindow(long tryOnStarted, long addToCart, double tryOnToCartRate) {}
  }
  ```
- **MIRROR**: DTO_PATTERN(`KpiSummaryResponse` 嵌套 record + Javadoc)。
- **GOTCHA**: `recommendation` 用 `String` 常量而非新枚举,保持轻量、与 JSON 直读一致(镜像 KPI DTO 用原始类型)。
- **VALIDATE**: 编译通过。

### Task 3: AnalyticsProperties 加 drapeDeployCutoff
- **ACTION**: 给 record 加第三个字段。
- **IMPLEMENT**:
  ```java
  @ConfigurationProperties("app.analytics")
  public record AnalyticsProperties(
          boolean enabled,
          List<String> cohorts,
          String drapeDeployCutoff   // ISO-8601 instant, 空 = Phase 4 端点须显式传 ?cutoff=
  ) {
      public AnalyticsProperties {
          cohorts = (cohorts == null || cohorts.isEmpty()) ? List.of("control", "variant") : cohorts;
      }
  }
  ```
- **MIRROR**: CONFIG_PATTERN。
- **GOTCHA**: `AnalyticsServiceTest.service(...)` 现在 `new AnalyticsProperties(enabled, List.of(...))` 只有 2 参 —— **加第 3 个字段会编译失败**。Task 7 必须同步把工厂改成 3 参(传 `null` 或固定 cutoff)。此外全仓 grep `new AnalyticsProperties(` 确认无其它构造点(当前仅测试与 Spring 绑定)。
- **VALIDATE**: `grep -rn "new AnalyticsProperties(" server/src` 全部已更新为 3 参后编译通过。

### Task 4: AnalyticsService 加 drapeDecision + 统计辅助
- **ACTION**: 在 `AnalyticsService` 加公开方法 `drapeDecision(Instant cutoff)` 与私有统计辅助。
- **IMPLEMENT**:
  ```java
  /** PRD 主指标目标:试穿→加购相对提升 ≥ +10%。 */
  private static final double TARGET_RELATIVE_LIFT = 0.10;

  @Transactional(readOnly = true)
  public DrapeDecisionResponse drapeDecision(Instant cutoff) {
      long tryBefore = eventRepository.countByEventTypeAndCreatedAtBefore(EventType.TRYON_STARTED, cutoff);
      long cartBefore = eventRepository.countByEventTypeAndCreatedAtBefore(EventType.ADD_TO_CART, cutoff);
      long tryAfter  = eventRepository.countByEventTypeAndCreatedAtGreaterThanEqual(EventType.TRYON_STARTED, cutoff);
      long cartAfter = eventRepository.countByEventTypeAndCreatedAtGreaterThanEqual(EventType.ADD_TO_CART, cutoff);

      double rateBefore = tryBefore > 0 ? (double) cartBefore / tryBefore : 0.0;
      double rateAfter  = tryAfter  > 0 ? (double) cartAfter  / tryAfter  : 0.0;
      double absLift = rateAfter - rateBefore;
      double relLift = rateBefore > 0 ? (rateAfter - rateBefore) / rateBefore : 0.0;

      double z = twoProportionZ(cartBefore, tryBefore, cartAfter, tryAfter);
      double p = Double.isNaN(z) ? 1.0 : 2.0 * (1.0 - normalCdf(Math.abs(z)));
      boolean significant = p < 0.05;

      String rec;
      if (tryBefore == 0 || tryAfter == 0) {
          rec = "INCONCLUSIVE";           // 任一窗口无试穿样本
      } else if (significant && relLift >= TARGET_RELATIVE_LIFT) {
          rec = "INVEST";
      } else if (significant && relLift < 0) {
          rec = "STOP";
      } else {
          rec = "INCONCLUSIVE";
      }
      return new DrapeDecisionResponse(cutoff,
          new DrapeDecisionResponse.FunnelWindow(tryBefore, cartBefore, rateBefore),
          new DrapeDecisionResponse.FunnelWindow(tryAfter,  cartAfter,  rateAfter),
          absLift, relLift, z, p, significant, rec);
  }

  /** 两比例 z 检验(pooled)。分母为 0 或退化时返回 NaN(上游按 p=1 处理)。 */
  private static double twoProportionZ(long x1, long n1, long x2, long n2) {
      if (n1 <= 0 || n2 <= 0) return Double.NaN;
      double p1 = clamp01((double) x1 / n1);
      double p2 = clamp01((double) x2 / n2);
      double pooled = clamp01((double) (x1 + x2) / (n1 + n2));
      double se = Math.sqrt(pooled * (1 - pooled) * (1.0 / n1 + 1.0 / n2));
      if (se == 0.0) return Double.NaN;
      return (p2 - p1) / se;
  }

  private static double clamp01(double v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /** 标准正态 CDF,Abramowitz & Stegun 7.1.26 erf 逼近(零依赖)。 */
  private static double normalCdf(double z) {
      return 0.5 * (1.0 + erf(z / Math.sqrt(2.0)));
  }
  private static double erf(double x) {
      double t = 1.0 / (1.0 + 0.3275911 * Math.abs(x));
      double y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
                - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
      return x >= 0 ? y : -y;
  }
  ```
- **MIRROR**: SERVICE_PATTERN(守卫比率 + `@Transactional(readOnly=true)`)。
- **IMPORTS**: `com.iyae.dto.DrapeDecisionResponse`、`java.time.Instant`。
- **GOTCHA**: `tryOnToCartRate` 可能 >1(加购不必然前置于试穿)——`clamp01` 只用于统计量,展示的 rate 保留原值。分母为 0 → 比率 0.0、z=NaN→p=1.0、建议 INCONCLUSIVE,绝不抛异常/除零。
- **VALIDATE**: `cd server && ./gradlew compileJava` 通过。

### Task 5: AnalyticsController 加决策端点
- **ACTION**: 加 `GET /api/admin/kpis/drape-decision`,解析可选 `?cutoff=` 与配置默认。
- **IMPLEMENT**:
  ```java
  // 构造注入新增: private final AnalyticsProperties analyticsProperties;
  /**
   * Phase 4 前后对比决策门。ADMIN-only(/api/admin/** URL 规则)。
   * cutoff 优先取查询参,否则取 app.analytics.drape-deploy-cutoff;两者皆空 → 400。
   */
  @GetMapping("/api/admin/kpis/drape-decision")
  public ResponseEntity<DrapeDecisionResponse> drapeDecision(
          @RequestParam(value = "cutoff", required = false) String cutoff) {
      String raw = (cutoff != null && !cutoff.isBlank())
              ? cutoff : analyticsProperties.drapeDeployCutoff();
      if (raw == null || raw.isBlank()) {
          throw new IllegalArgumentException(
              "cutoff required: pass ?cutoff=<ISO-8601 instant> or set app.analytics.drape-deploy-cutoff");
      }
      Instant parsed;
      try { parsed = Instant.parse(raw.trim()); }
      catch (DateTimeException ex) {
          throw new IllegalArgumentException("Invalid cutoff (expect ISO-8601 instant, e.g. 2026-09-10T00:00:00Z): " + raw);
      }
      return ResponseEntity.ok(analyticsService.drapeDecision(parsed));
  }
  ```
- **MIRROR**: CONTROLLER_PATTERN(ADMIN URL 门控注释,无方法级 `@PreAuthorize`)。
- **IMPORTS**: `com.iyae.dto.DrapeDecisionResponse`、`com.iyae.config.AnalyticsProperties`、`java.time.Instant`、`java.time.DateTimeException`。
- **GOTCHA**: `IllegalArgumentException` 被 `GlobalExceptionHandler` 映射为 400(见根 CLAUDE.md 约定),无需手写 try/catch 返回码。路径以 `/api/admin/` 开头才被 `SecurityConfig:51` 门控。
- **VALIDATE**: 编译通过;`curl` 该端点带 DESIGNER token → 403、带 ADMIN + 合法 cutoff → 200。

### Task 6: application.yml 加 cutoff 配置
- **ACTION**: 在 `app.analytics` 块加一行。
- **IMPLEMENT**:
  ```yaml
    analytics:
      enabled: ${ANALYTICS_ENABLED:true}
      cohorts: ${ANALYTICS_COHORTS:control,variant}
      # Phase 1-3 垂坠改动的部署时间戳(ISO-8601 instant),用于 /api/admin/kpis/drape-decision 前后对比切分。
      # 留空则该端点须显式传 ?cutoff=。
      drape-deploy-cutoff: ${ANALYTICS_DRAPE_DEPLOY_CUTOFF:}
  ```
- **MIRROR**: 现有 `app.analytics.*` env 占位风格。
- **GOTCHA**: `${VAR:}` 空默认 → 绑定为空串,record 里作空处理;不要写成 `null`。同步在 CLAUDE.md 的环境变量表加 `ANALYTICS_DRAPE_DEPLOY_CUTOFF`(文档任务,见 Task 12)。
- **VALIDATE**: 应用启动上下文加载不报错(`./gradlew test` 的 `IyaeApplicationTests` 通过)。

### Task 7: server 单测(service)
- **ACTION**: 更新 `AnalyticsServiceTest`——修工厂签名 + 加 drapeDecision 用例。
- **IMPLEMENT**:
  - 工厂改 3 参:`new AnalyticsProperties(enabled, List.of("control","variant"), null)`。
  - 用例(cutoff 用固定 `Instant.parse("2026-09-10T00:00:00Z")`):
    - `drapeDecision_computesLiftAndRate`:存根 before(try=100,cart=10)/after(try=100,cart=20)→ rateBefore=0.1、rateAfter=0.2、absLift≈0.1、relLift≈1.0、significant=true、recommendation="INVEST"。
    - `drapeDecision_noImprovement_recommendsStopOrInconclusive`:after 比率显著更低 → "STOP";after 略高但不显著 → "INCONCLUSIVE"。
    - `drapeDecision_zeroBefore_isInconclusive`:tryBefore=0 → rate/z 不炸,recommendation="INCONCLUSIVE",pValue=1.0。
- **MIRROR**: TEST_STRUCTURE(service 工厂 + Mockito `when(...).thenReturn(...)` + AssertJ)。
- **GOTCHA**: 存根新方法要用 `eq(EventType.TRYON_STARTED)`/`eq(EventType.ADD_TO_CART)` + `any(Instant.class)` 或具体 cutoff;`assertThat(double)` 用 `isCloseTo(x, within(1e-6))` 避免浮点相等失败。
- **VALIDATE**: `cd server && ./gradlew test --tests '*AnalyticsServiceTest'` 全绿。

### Task 8: server 单测(controller)
- **ACTION**: 更新 `AnalyticsControllerTest`——加新端点用例。注意需 `@MockBean AnalyticsProperties`(或用 `@Import` 提供)因控制器现依赖它。
- **IMPLEMENT**:
  - `drapeDecision_asAdmin_returns200`:`@WithMockUser(roles="ADMIN")`,存根 `analyticsProperties.drapeDeployCutoff()` 返回 `"2026-09-10T00:00:00Z"`、`analyticsService.drapeDecision(any())` 返回一个样例响应 → `get("/api/admin/kpis/drape-decision")` 期望 200 + JSON 字段。
  - `drapeDecision_withQueryCutoff_returns200`:带 `?cutoff=2026-09-01T00:00:00Z`,验证 `drapeDecision(Instant.parse(...))` 被调用。
  - `drapeDecision_missingCutoff_returns400`:属性返回空 + 无查询参 → 400。
  - `drapeDecision_asDesigner_returns403`:`roles="DESIGNER"`。
- **MIRROR**: TEST_STRUCTURE(`@WebMvcTest` + `WithMockUser` roles + `kpis_asDesigner_returns403`)。
- **GOTCHA**: `AnalyticsController` 现有 2 个 `@MockBean`(service、userRepository);新增第 3 个 `@MockBean AnalyticsProperties`。`WebMvcSecurityConfig`(测试支持)已把 `/api/admin/**` 映射为 ADMIN。
- **VALIDATE**: `./gradlew test --tests '*AnalyticsControllerTest'` 全绿。

### Task 9: web api 客户端类型 + getter
- **ACTION**: 在 `web/lib/api.ts` 加类型与 getter。
- **IMPLEMENT**:
  ```ts
  export interface FunnelWindow { tryOnStarted: number; addToCart: number; tryOnToCartRate: number; }
  export interface DrapeDecisionResponse {
    cutoff: string; before: FunnelWindow; after: FunnelWindow;
    absoluteLift: number; relativeLift: number;
    zScore: number; pValue: number; significant: boolean;
    recommendation: "INVEST" | "STOP" | "INCONCLUSIVE";
  }
  export interface CohortKpi {
    cohort: string; views: number; tryOnStarted: number; addToCart: number;
    checkoutInitiated: number; ordersPaid: number; ordersReturned: number;
    conversionRate: number; returnRate: number;
  }
  export interface SizeBracketKpi { cohort: string; sizeBracket: string; paidCount: number; }
  export interface KpiSummaryResponse { cohorts: CohortKpi[]; sizeBrackets: SizeBracketKpi[]; }
  ```
  在 `export const analytics = { track: ... }` 内追加(注意与 track 的 fire-and-forget 不同,这些**会 throw ApiError**,面板需 try/catch):
  ```ts
    /** ADMIN-only. Throws ApiError (unlike track). */
    kpis: () => api.get<KpiSummaryResponse>("/api/admin/kpis"),
    drapeDecision: (cutoff?: string) =>
      api.get<DrapeDecisionResponse>(
        `/api/admin/kpis/drape-decision${cutoff ? `?cutoff=${encodeURIComponent(cutoff)}` : ""}`),
  ```
- **MIRROR**: WEB_API_GETTER + 现有 `admin`(api.ts:406)getter 风格。
- **GOTCHA**: `cutoff` 是 `string`(后端返回 `Instant` → JSON ISO 字符串)。`encodeURIComponent` 编码 `+`/`:`。
- **VALIDATE**: `cd web && npx tsc --noEmit` 无新错误。

### Task 10: web ADMIN 决策面板页
- **ACTION**: 创建 `web/app/admin/kpis/page.tsx`。
- **IMPLEMENT**: `"use client"`;`useRequireAuth("ADMIN")` + `user.role!=="ADMIN"` 兜底(镜像 `web/app/admin/page.tsx:500-512`)。`useEffect` 拉 `analytics.drapeDecision()`(默认配置 cutoff)与 `analytics.kpis()`,`try/catch` 存 `ApiError`。渲染:
  - 决策卡:before/after 的 `tryOnStarted`/`addToCart`/`tryOnToCartRate`(百分比,`(rate*100).toFixed(1)+"%"`),`relativeLift`(`(x*100).toFixed(1)+"%"`)、`zScore.toFixed(2)`、`pValue.toExponential(2)` 或 `toFixed(4)`、`significant`;
  - `recommendation` 徽章:`INVEST`→success、`STOP`→destructive、`INCONCLUSIVE`→warning(用 `@/lib/status` 或 Badge variant,遵守语义色,禁止硬编码 hex/`stone-*`);
  - 下方 per-cohort 明细表复用 `kpis()` 数据(简单 `<table>`,语义色)。
  - cutoff 空导致 400 时,展示"未配置 cutoff,请设 `ANALYTICS_DRAPE_DEPLOY_CUTOFF` 或传 ?cutoff="的提示。
- **MIRROR**: WEB_ADMIN_GATE + admin 页的 `SiteHeader variant="app"` + `PageShell` + `font-display` 标题。
- **IMPORTS**: `useRequireAuth`、`analytics`、类型、`SiteHeader`、`PageShell`、`Badge`、`toast`(可选)。
- **GOTCHA**: 页面若用 `useSearchParams` 读 `?cutoff=` 必须包 `<Suspense>`(Next.js 16 约定,见 web CLAUDE.md);**v1 建议不读 searchParams,只用后端默认 cutoff**,保持简单。所有颜色用语义 token(`text-foreground`/`text-muted-foreground`/`bg-card`/`bg-muted`)。
- **VALIDATE**: `npm run dev` 后以 ADMIN 登录访问 `/admin/kpis` 渲染决策卡;以 BUYER 访问被重定向到 `/dashboard`。

### Task 11: web api 单测
- **ACTION**: 在 `web/__tests__/lib/api.test.ts` 加 getter 断言。
- **IMPLEMENT**: mock `fetch` 返回样例 `DrapeDecisionResponse`,断言 `analytics.drapeDecision("2026-09-10T00:00:00Z")` 命中 `/api/admin/kpis/drape-decision?cutoff=...`(URL 编码正确)、无 cutoff 时命中无 query 的路径;`analytics.kpis()` 命中 `/api/admin/kpis`。
- **MIRROR**: 现有 `api.test.ts` 的 fetch mock + URL 断言风格。
- **GOTCHA**: 现有 test 通过 `localStorage` 注入 JWT;沿用 setup。断言 `encodeURIComponent` 后的 `cutoff` 值。
- **VALIDATE**: `cd web && npm run test -- api.test` 全绿。

### Task 12: 决策报告文档 + PRD 状态 + CLAUDE.md 环境变量
- **ACTION**: 建 `.claude/PRPs/reports/3d-tryon-drape-realism-phase4-conversion-decision-gate-report.md`;更新 PRD Phase 4 行;根 CLAUDE.md 环境变量表加 `ANALYTICS_DRAPE_DEPLOY_CUTOFF`。
- **IMPLEMENT(报告文档结构)**:
  - **方法学**:前后对比定义、cutoff 含义、主指标 = 试穿→加购聚合事件比率、两比例 z 检验公式、显著性阈 p<0.05、INVEST/STOP/INCONCLUSIVE 判据(相对 lift ≥ +10% 且显著)。
  - **已知限制**:无 session join(聚合比率近似)、时间混杂(前后对比非并发 A/B)、rate 可 >1 的解释、决策门为人审。
  - **复现步骤**:设 `ANALYTICS_DRAPE_DEPLOY_CUTOFF`(Phase 1-3 合并/部署时刻)、以 ADMIN 打开 `/admin/kpis` 或 `curl -H "Authorization: Bearer <admin-jwt>" /api/admin/kpis/drape-decision`。
  - **结果占位表**:before/after 计数、rate、lift、z、p、建议(待部署 + 采集真流量后填充)。
  - **前置依赖**:Phase 0 收尾(部署 + 真人 QA 采集穿模率/无纹理占比基线)与本阶段共享同一验证窗口。
- **PRD 更新**: Phase 4 行 `Status` pending→`in-progress(...)`,`PRP Plan` 列挂 `[plan](../plans/3d-tryon-drape-realism-phase4-conversion-decision-gate.plan.md)`。
- **GOTCHA**: 报告是**可填充模板**——真实结论需部署 + 流量,不要在无数据时编造数字。
- **VALIDATE**: 文档链接可跳转;PRD 表格 Markdown 未破格。

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `drapeDecision_computesLiftAndRate` | before(100,10) after(100,20) | rateBefore=0.1, rateAfter=0.2, relLift≈1.0, significant=true, "INVEST" | No |
| `drapeDecision_noImprovement` | after 显著更低 | recommendation="STOP" | No |
| `drapeDecision_inconclusive_smallLift` | after 略高但 p≥0.05 | "INCONCLUSIVE" | Yes(不显著) |
| `drapeDecision_zeroBefore` | tryBefore=0 | 不抛异常, pValue=1.0, "INCONCLUSIVE" | Yes(零分母) |
| `drapeDecision_asAdmin_returns200` | ADMIN + 配置 cutoff | 200 + JSON | No |
| `drapeDecision_withQueryCutoff` | ADMIN + ?cutoff= | 200, 用查询参 | Yes |
| `drapeDecision_missingCutoff_returns400` | 无配置无查询参 | 400 | Yes |
| `drapeDecision_asDesigner_returns403` | DESIGNER token | 403 | Yes(authz) |
| `api.drapeDecision getter` | cutoff string | 命中编码后的 URL | Yes(编码) |
| `api.kpis getter` | — | 命中 `/api/admin/kpis` | No |

### Edge Cases Checklist
- [x] 零分母(tryBefore/tryAfter = 0)→ INCONCLUSIVE,不除零
- [x] rate > 1(addToCart > tryOnStarted)→ 展示原值,统计量 clamp01
- [x] cutoff 缺失 → 400
- [x] cutoff 非法格式 → 400(`DateTimeException`)
- [x] 非 ADMIN 角色 → 403
- [x] SE=0(退化)→ z=NaN → p=1.0
- [ ] 网络失败(面板 fetch)→ 捕获 ApiError 显示提示

---

## Validation Commands

### Static Analysis
```bash
cd server && ./gradlew compileJava compileTestJava
cd web && npx tsc --noEmit && npm run lint
```
EXPECT: 零编译/类型错误(web lint 无新增违规)

### Unit Tests
```bash
cd server && ./gradlew test --tests '*AnalyticsServiceTest' --tests '*AnalyticsControllerTest'
cd web && npm run test -- api.test
```
EXPECT: 全部通过

### Full Test Suite
```bash
cd server && ./gradlew test
cd web && npm run test
```
EXPECT: 无回归(server 现 ~528 → 增至 ~536;web 现 ~335 → 增几例)

### Manual Validation
- [ ] 设 `ANALYTICS_DRAPE_DEPLOY_CUTOFF=2026-09-10T00:00:00Z` 启动 server
- [ ] ADMIN 登录 → `/admin/kpis` 显示决策卡(before/after/lift/z/p/建议)
- [ ] BUYER 访问 `/admin/kpis` → 重定向 `/dashboard`
- [ ] `curl -H "Authorization: Bearer <designer-jwt>" .../api/admin/kpis/drape-decision` → 403
- [ ] 不设 cutoff 且不传 ?cutoff → 端点 400,面板显示配置提示

---

## Acceptance Criteria
- [ ] 所有 12 个任务完成
- [ ] 所有 validation 命令通过
- [ ] 单测新增并通过(service + controller + web api)
- [ ] 无类型/lint 错误
- [ ] 面板匹配 UX 设计(前后对比 + lift + 显著性 + 建议徽章)
- [ ] 决策报告文档就位(方法学 + 限制 + 复现 + 可填充结果)
- [ ] PRD Phase 4 状态更新为 in-progress 并挂 plan 链接

## Completion Checklist
- [ ] 代码遵循发现的模式(派生查询命名、嵌套 record DTO、ADMIN URL 门控、语义色)
- [ ] 错误处理沿用 `IllegalArgumentException`→400、best-effort 只读事务
- [ ] 无新依赖(正态 CDF 内联)
- [ ] 无 schema 变更 / 无新 Flyway 迁移
- [ ] 测试遵循 `@WebMvcTest`/Mockito 工厂模式
- [ ] 文档未编造无数据的结论(可填充模板)
- [ ] 无超范围新增(不做 cohort 门控渲染 / 不做 charting 库)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 前后对比时间混杂(季节/促销)污染 lift | H | M | 文档明确标注为近似;cutoff 可调做敏感性;决策门人审 |
| 无 session join → 事件比率非真 per-session 转化,rate 可 >1 | H | M | 文档标注;统计量 clamp01;作为方向性信号而非发表级检验 |
| 真流量样本不足 → 长期 INCONCLUSIVE | M | M | 端点/面板始终可跑;等流量累积;先用配置 cutoff 观察 |
| 加 AnalyticsProperties 字段破坏现有构造点 | M | L | Task 3 GOTCHA:grep `new AnalyticsProperties(` 同步全部 3 参 |
| Phase 0 基线未采集(穿模率/无纹理占比)| M | L | 属 Phase 0 收尾,报告标注共享验证窗口,不阻塞本阶段代码 |

## Notes
- **方法与产出经用户确认**:前后对比(非并发 A/B,因 worker 已把材质/PBR/push-out 烘焙进 GLB,渲染时无法回退旧渲染)+ 增强 API + web admin 面板 + 决策文档。
- **零 schema 变更**:`analytics_events` 已含 `created_at`(`@CreationTimestamp`)与 `cohort`,前后对比只需按 `created_at` 切分,不动库结构。
- **决策门是人审**:端点/面板给出 INVEST/STOP/INCONCLUSIVE 方向建议,最终"是否投入 Phase 5 布料仿真"由人结合限制与业务判断,不自动触发。
- **主指标口径**:试穿→加购 = `count(ADD_TO_CART)/count(TRYON_STARTED)`,与现有 `conversionRate=ordersPaid/checkoutInitiated` 同为聚合比率口径,保持一致性。
