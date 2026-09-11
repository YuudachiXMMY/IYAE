# Implementation Report: Phase 4 — 转化验证与决策门 (Drape Conversion Decision Gate)

## Summary
在 Phase 0 已建好的埋点漏斗(VIEW/TRYON_STARTED/ADD_TO_CART/CHECKOUT_INITIATED/ORDER_PAID/ORDER_RETURNED + cohort)之上,新增了一个**前后对比(pre/post 部署)决策门**:后端 `GET /api/admin/kpis/drape-decision` 端点按可配置 cutoff 时间戳切分 `analytics_events`,计算部署前 vs 部署后的**试穿→加购(TRYON_STARTED→ADD_TO_CART)聚合转化率**、绝对/相对 lift 与两比例 z 检验显著性,产出 `INVEST`/`STOP`/`INCONCLUSIVE` 方向建议;前端新增 ADMIN-gated `/admin/kpis` 面板展示决策卡 + per-cohort KPI 明细。零 schema 变更、零新依赖(正态 CDF 内联实现)。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large(如期) |
| Confidence | 8/10 | 达成(代码/单测一遍过;实机结论需部署流量) |
| Files Changed | ~11 (server 6 + web 3 + doc + PRD) | 12 改/建 + PRD + CLAUDE.md 环境变量 |

## 决策门方法学 (Methodology)

- **前后对比切分**:以 `cutoff`(Phase 1-3 部署时刻)按 `analytics_events.created_at` 切成 before(`< cutoff`)/after(`>= cutoff`,半开区间)两窗。
- **主指标**:试穿→加购率 = `count(ADD_TO_CART) / count(TRYON_STARTED)`(窗口内聚合事件比率),与现有 `conversionRate = ordersPaid/checkoutInitiated` 同口径。
- **lift**:绝对 = `rateAfter − rateBefore`;相对 = `(rateAfter − rateBefore) / rateBefore`。
- **显著性**:两比例 z 检验(pooled),双尾 `p = 2(1 − Φ(|z|))`,`Φ` 由 Abramowitz & Stegun 7.1.26 erf 逼近内联实现;阈值 `p < 0.05`。
- **建议判据**:任一窗口无试穿样本 → `INCONCLUSIVE`;显著且相对 lift ≥ +10%(PRD 主指标目标)→ `INVEST`;显著且相对 lift < 0 → `STOP`;其余 → `INCONCLUSIVE`。

## 已知限制 (Honest Limitations)

- **无 session join**:`analytics_events` 无 session id 关联 TRYON_STARTED 与 ADD_TO_CART,主指标为聚合事件比率,非真 per-session 转化;比率可能 >1(加购不必然前置于试穿),统计量对 p̂ 做 clamp01。
- **时间混杂**:前后对比非并发 A/B,季节/促销等时间因素会污染 lift(选前后对比是因为 worker 已把材质/PBR/push-out 烘焙进 GLB,渲染时无法按用户回退旧渲染;经用户确认)。
- **决策为人审**:端点/面板给出方向建议,`INVEST` 不自动触发 Phase 5 布料仿真。
- **样本量**:真流量不足时长期返回 `INCONCLUSIVE`——属预期,累积后再判。

## 复现步骤 (How To Run)

1. 设 `ANALYTICS_DRAPE_DEPLOY_CUTOFF=<Phase 1-3 部署 ISO-8601 instant>`(如 `2026-09-10T00:00:00Z`)启动 server。
2. 以 ADMIN 登录 → 访问 `/admin/kpis` 查看决策卡;或
   `curl -H "Authorization: Bearer <admin-jwt>" http://localhost:3001/api/admin/kpis/drape-decision`。
3. 覆盖窗口做敏感性分析:`.../drape-decision?cutoff=2026-09-01T00:00:00Z`。

## 结果占位表 (待部署 + 真流量后填充)

| 窗口 | 试穿数 | 加购数 | 试穿→加购率 |
|---|---|---|---|
| 部署前 (before) | _TBD_ | _TBD_ | _TBD_ |
| 部署后 (after) | _TBD_ | _TBD_ | _TBD_ |

| 指标 | 值 |
|---|---|
| 绝对 lift | _TBD_ |
| 相对 lift | _TBD_ |
| z / p | _TBD_ |
| 显著 (p<0.05) | _TBD_ |
| **建议** | _TBD (INVEST / STOP / INCONCLUSIVE)_ |

> ⚠️ 上表在部署 Phase 1-3 到生产并采集真实流量后填充,不在无数据时编造数字。

## 前置依赖

- **Phase 0 收尾**:穿模率、"无纹理服装"占比基线仍需部署 + 真人 QA 采集,与本阶段共享同一验证窗口。

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | AnalyticsEventRepository 前后 count 查询 | ✅ Complete | 半开区间 before(`<`)/after(`>=`) |
| 2 | DrapeDecisionResponse DTO | ✅ Complete | 嵌套 FunnelWindow record |
| 3 | AnalyticsProperties.drapeDeployCutoff | ✅ Complete | 3 参 record;测试工厂同步 |
| 4 | AnalyticsService.drapeDecision + z 检验 | ✅ Complete | 内联正态 CDF,守卫比率 |
| 5 | AnalyticsController 决策端点 | ✅ Complete | ADMIN URL 门控;400 on missing/invalid cutoff |
| 6 | application.yml drape-deploy-cutoff | ✅ Complete | `${ANALYTICS_DRAPE_DEPLOY_CUTOFF:}` |
| 7 | AnalyticsServiceTest (+4) | ✅ Complete | invest/stop/inconclusive/zero-denom |
| 8 | AnalyticsControllerTest (+5) | ✅ Complete | 200/query-cutoff/400×2/403 |
| 9 | api.ts 类型 + analytics.kpis()/drapeDecision() | ✅ Complete | throws ApiError(与 track 区分) |
| 10 | /admin/kpis 面板 | ✅ Complete | Deviation — effect 内改用 async IIFE(避 set-state-in-effect lint) |
| 11 | api.test.ts (+3) | ✅ Complete | URL 编码 + kpis 路径 |
| 12 | 决策报告 + PRD + CLAUDE.md 环境变量 | ✅ Complete | 本文件 + 状态更新 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | ✅ Pass | `tsc --noEmit` 0 错;变更文件 eslint 0 错(全仓既有 54 `set-state-in-effect` 与本次无关);server compileJava 0 错 |
| Unit Tests | ✅ Pass | server +9(service 7→11, controller 7→12);web api +3 |
| Build | ✅ Pass | server `gradle test` BUILD SUCCESSFUL(550 methods);web `tsc` clean |
| Integration | N/A | 前后对比结论需部署 + 真流量(live/QA),不在本阶段自动跑 |
| Edge Cases | ✅ Pass | 零分母、非法/缺失 cutoff、非 ADMIN 403、比率>1 clamp、SE=0→p=1 |

## Files Changed

| File | Action | 说明 |
|---|---|---|
| `server/.../repository/AnalyticsEventRepository.java` | UPDATE | +2 派生 count 查询 |
| `server/.../dto/DrapeDecisionResponse.java` | CREATE | 决策响应 record |
| `server/.../config/AnalyticsProperties.java` | UPDATE | +drapeDeployCutoff |
| `server/.../service/AnalyticsService.java` | UPDATE | +drapeDecision + z 检验 + 正态 CDF |
| `server/.../controller/AnalyticsController.java` | UPDATE | +GET /api/admin/kpis/drape-decision |
| `server/src/main/resources/application.yml` | UPDATE | +drape-deploy-cutoff |
| `server/.../service/AnalyticsServiceTest.java` | UPDATE | +4 tests + 3 参工厂 |
| `server/.../controller/AnalyticsControllerTest.java` | UPDATE | +5 tests + @MockBean AnalyticsProperties |
| `web/lib/api.ts` | UPDATE | +类型 + analytics.kpis()/drapeDecision() |
| `web/app/admin/kpis/page.tsx` | CREATE | ADMIN 决策面板 |
| `web/__tests__/lib/api.test.ts` | UPDATE | +3 getter 测试 |
| `.claude/PRPs/prds/3d-tryon-garment-drape-realism.prd.md` | UPDATE | Phase 4 状态 |
| `CLAUDE.md` | UPDATE | +ANALYTICS_DRAPE_DEPLOY_CUTOFF 环境变量 |

## Deviations from Plan

- **Task 10**:面板 `useEffect` 从"`useCallback` load + `void load()`"改为 **effect 内 async IIFE + cancelled 标志**。WHY:ESLint `react-hooks/set-state-in-effect` 对同步 setState-in-effect 报错;async IIFE 让所有 setState 落在 await 之后(异步),并顺带加了卸载防护。行为等价,更干净。

## Issues Encountered

- **gradle-wrapper.jar 缺失**(worktree gitignored):改用缓存的 `~/.gradle/wrapper/dists/gradle-8.10-bin` 启动器直接跑,测试正常。
- **全仓既有 lint 失败**(54 `react-hooks/set-state-in-effect` errors,均在未触碰文件):本次仅确保变更文件零 lint 错,未扩大范围修复既有问题。

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `AnalyticsServiceTest.java` | +4 | drapeDecision invest/stop/inconclusive/zero-denominator |
| `AnalyticsControllerTest.java` | +5 | 端点 200 / query-cutoff / missing-400 / invalid-400 / designer-403 |
| `api.test.ts` | +3 | analytics.kpis 路径、drapeDecision URL 编码、无 cutoff 省略 query |

## Next Steps
- [ ] Code review via `/code-review`
- [ ] Create/refresh PR via `/prp-pr`
- [ ] 部署 Phase 1-3 到生产 + 设 `ANALYTICS_DRAPE_DEPLOY_CUTOFF` → 采集真流量 → 填充结果占位表 → 人审做 Phase 5 门控决策
