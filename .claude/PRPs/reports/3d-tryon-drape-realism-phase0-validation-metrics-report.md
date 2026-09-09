# Implementation Report: 3D 试穿垂坠真实感 — Phase 0(验证与度量地基)

## Summary
落地了 Phase 0 的**度量地基代码**:扩展既有 analytics 栈新增 `TRYON_STARTED` 事件并接入 `/api/admin/kpis` cohort 漏斗;从 `AvatarViewer` 发射试穿会话事件(经 `SmartARViewer` → PDP 传 `trackingContext`);worker 新增**非阻断**的 `validate_material_and_uv` 审计 + `MATERIAL_AUDIT` 日志,产出"无纹理占比"度量。无新表、无新 Flyway 迁移。运营性的实机根因验证 + 基线数字采集(Task 12)需运行时环境,已在 findings 文档中留出方法论与占位。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium(符合) |
| Confidence | 8/10 | 代码部分 10/10 通过全部校验;运营部分需运行时环境(如计划所料) |
| Files Changed | ~12 | 11 改 + 1 新建 = 12 |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | EventType 新增 `TRYON_STARTED` | ✅ Complete | 放在 `VIEW` 后(漏斗顺序);无迁移 |
| 2 | `CohortKpi` 加 `tryOnStarted` | ✅ Complete | 插在 `views` 后 |
| 3 | `AnalyticsService.kpisByCohort()` 填充 | ✅ Complete | 复用既有聚合,无新查询 |
| 4 | AvatarViewer 发射 `TRYON_STARTED` | ✅ Complete | ref 守卫单发 + `trackingContext` prop |
| 5 | SmartARViewer 转发 `trackingContext` | ✅ Complete | desktop 路径;AR/iOS 路径按计划不覆盖 |
| 6 | PDP 传入 `trackingContext` | ✅ Complete | `{ productId, surface:"pdp" }` |
| 7 | worker `validate_material_and_uv`(咨询式) | ✅ Complete | 未接入 `validate_rigged_glb` 失败链 |
| 8 | main.py 非阻断 `MATERIAL_AUDIT` 日志 | ✅ Complete | 校验通过后、`complete_task` 前 |
| 9 | worker validator 单测(3 例) | ✅ Complete | 正/负/解析失败 |
| 10 | `AnalyticsServiceTest` 更新 | ✅ Complete | +tryOn 计数断言 |
| 11 | `AnalyticsControllerTest` 加用例 | ✅ Complete | `TRYON_STARTED` → 202 |
| 12 | 实机根因验证 + 基线文档 | ⚠️ Partial | 机制+方法论已落地(`docs/phase0-drape-realism-findings.md`);实机数字需 rigging 容器 + SMPL-X + 部署漏斗,本环境无法运行 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | ✅ Pass | server `compileJava/compileTestJava` OK;web `tsc --noEmit` 0 错误;新代码文件(AvatarViewer/SmartARViewer)ESLint 0 错误 |
| Unit Tests | ✅ Pass | server analytics 测试绿;worker validator **51 passed**(含 3 新);web **318 passed / 33 文件** |
| Build / Regression | ✅ Pass | server **全量测试 BUILD SUCCESSFUL**(零回归);web tsc 全项目类型通过 |
| Integration | ⚠️ N/A(本环境) | 需运行栈 + docker `--profile rigging` + SMPL-X;见 findings 文档运行步骤 |
| Edge Cases | ✅ Pass | 未知类型→400、匿名→403、cohort 缺 tryOn→0、GLB 解析失败→非 raise、MagicMock 属性显式置 None |

> 注:未运行 `next build` 打包——web 存在**既有**(与本改动无关)的 `react-hooks/set-state-in-effect` lint 错误(`app/products/[id]/page.tsx:130/165`,`setProductLoading`/`setReviewsLoading`),Next 16 构建会因这些既有 lint 失败,故以 `tsc --noEmit`(全项目类型门)+ 全量 vitest + 针对性 ESLint 作为等价校验。

## Files Changed

| File | Action | Lines |
|---|---|---|
| `server/.../entity/enums/EventType.java` | UPDATED | +1 |
| `server/.../dto/KpiSummaryResponse.java` | UPDATED | +1 |
| `server/.../service/AnalyticsService.java` | UPDATED | +2/-1 |
| `server/.../test/.../service/AnalyticsServiceTest.java` | UPDATED | +4/-1 |
| `server/.../test/.../controller/AnalyticsControllerTest.java` | UPDATED | +20 |
| `web/components/AvatarViewer.tsx` | UPDATED | +21 |
| `web/components/SmartARViewer.tsx` | UPDATED | +4 |
| `web/app/products/[id]/page.tsx` | UPDATED | +1 |
| `worker/validator.py` | UPDATED | +48 |
| `worker/main.py` | UPDATED | +14 |
| `worker/tests/test_validator.py` | UPDATED | +64 |
| `docs/phase0-drape-realism-findings.md` | CREATED | +~110 |

## Deviations from Plan
- **Task 12(实机验证/基线)未执行实机部分**:需 rigging 容器 + SMPL-X 模型 + 部署的埋点漏斗,后台环境无法运行。**代码机制全部就绪**(`validate_material_and_uv` 自动确认根因、`MATERIAL_AUDIT` 日志度量占比、`/api/admin/kpis` 漏斗),findings 文档给出运行步骤 + 结论/基线占位表。据此**PRD Phase 0 保持 `in-progress`**(未 flip 到 `complete`),忠实反映"代码已交付、实机数据待采集"。
- 其余任务(1–11)均**完全按计划实现**,无偏差。

## Issues Encountered
- **gradle-wrapper.jar 被 gitignore**(worktree 已知问题):改用缓存 `~/.gradle/wrapper/dists/gradle-8.10-bin/.../bin/gradle` 运行。
- **web 无 node_modules**(fresh worktree):`npm install` 后 tsc/vitest 可用。
- **worker 无测试依赖**:在 `$CLAUDE_JOB_DIR/tmp` 建 venv 装 `pytest pygltflib trimesh numpy requests` 运行 validator 套件。
- **MagicMock 陷阱**:`attrs.TEXCOORD_0`/`prim.material` 在裸 MagicMock 上默认非 None → 负例测试显式置 `None`(已在 `_make_material_primitive` 处理并注释)。

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `worker/tests/test_validator.py` | +3(`TestValidateMaterialAndUv`) | 缺材质/UV、含材质/UV、解析失败不 raise |
| `server/.../AnalyticsServiceTest.java` | +断言(既有用例内) | KPI 漏斗含 `tryOnStarted` 计数 + 空 cohort 归零 |
| `server/.../AnalyticsControllerTest.java` | +1(`track_tryonStarted_returns202`) | `TRYON_STARTED` 事件接收 + metadata 透传 |

## Runtime Validation Addendum（"采集根因+基线"后续）

用户要求"按 findings 文档运行时采集根因+基线后 flip Phase 0 → complete"。**已采集能采集的,并对结论做对抗性核验;但据实判定不应 flip 到 complete。**

**做了什么**:用仅含 base 依赖的经验探针（trimesh+pygltflib+numpy+pillow,**无 SMPL-X/libigl/Docker**）跑**真实 worker 代码路径**,`validate_material_and_uv` 测量;并用 5-agent 工作流对抗性核验（3 refuter + 漏斗验证 + 诚实性批判,全部 `refuted=false`/high）。

| 项 | 结果 |
|---|---|
| 根因（是否丢材质） | ✅ **确认丢材质**:源 GLB 有 material+UV;python + stub 两条生产写出路径输出**均**无 → 前端套 glTF 默认灰白壳 |
| 因果修正 | `trimesh.load(force="mesh")` 实测**保留** uv/material;丢失在 `_load_garment_glb` 抽取 +`skinned_glb_writer` 不写出 → **B1 须改两处**(PRD 原述"force=mesh 压平丢材质"不精确,已在 findings 修正) |
| 无纹理占比基线 | ✅ **100%**(结构性,写出端根本不写材质) |
| 穿模率基线 | ⏳ 延后:需真人视觉 QA 渲染场景,无头环境不可采/不可伪造 |
| 转化漏斗 | 机制✅端到端可读(单测覆盖);数值基线⏳需部署+真实流量 |

**为何不 flip 到 `complete`**（诚实性批判裁决 `flip_to_complete_honest=false`）:Phase 0 三条 success signal 中"基线数据入库"仅部分满足——3 项数值基线只有"无纹理占比"能在此确定,穿模率与转化漏斗数值需 live/QA 环境。把 Phase 0 标 `complete` 会**过度声称**两项不存在的基线,违反忠实报告。故保持 `in-progress` 并把措辞升级为反映真实进度(根因已实机确认 + 无纹理基线已入库)。两条门控信号(根因明确 + 主指标可测/漏斗可读)**已满足**。

**要真正 flip 到 complete 还差**:① 部署应用后读一次 `GET /api/admin/kpis` 取转化漏斗数值基线;② 一轮真人穿模抽样评分。二者只能在 live/QA 环境做。

## Next Steps
- [ ] live/QA:采集穿模抽样评分 + 部署后读转化漏斗数值基线 → 齐后方可诚实 flip Phase 0 → `complete`
- [ ] `/code-review` 审查本次改动
- [ ] Phase 1(B1 材质恢复 + D1 阴影 + D2 兜底材质)—— B1 须同时改 `_load_garment_glb`(透传 UV/材质)+ `skinned_glb_writer`(写 TEXCOORD_0/material);落地后把 `validate_material_and_uv` 升级为硬校验回归门
