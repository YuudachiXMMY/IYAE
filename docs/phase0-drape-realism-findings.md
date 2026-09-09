# Phase 0 — 3D 试穿垂坠真实感:验证与度量地基(Findings）

> 状态：**度量机制已落地（代码）；实机数据待采集（需运行时环境）**
> 关联 PRD：`.claude/PRPs/prds/3d-tryon-garment-drape-realism.prd.md`（Phase 0）
> 关联计划：`.claude/PRPs/plans/completed/3d-tryon-drape-realism-phase0-validation-metrics.plan.md`

本 Phase 0 交付两类东西：
1. **可运行的度量机制**（已随本 PR 落地、已测试）——让根因可自动确认、让漏斗可读数。
2. **需在运行时环境采集的基线数字**（下方 4 张表，留空待填）——需 rigging 容器 + SMPL-X 模型 + 部署的埋点漏斗。

---

## 1. 已落地的度量机制（代码）

| 机制 | 位置 | 作用 |
|------|------|------|
| `TRYON_STARTED` 事件类型 | `server/.../entity/enums/EventType.java` | 让试穿会话进入既有 analytics 漏斗（无迁移，`event_type VARCHAR(32)`） |
| 前端发射 `TRYON_STARTED` | `web/components/AvatarViewer.tsx`（经 `SmartARViewer` → PDP 传 `trackingContext`） | 模型就绪时每次挂载发一次；PDP 带 `productId`+`surface:"pdp"` |
| KPI 漏斗含试穿阶段 | `AnalyticsService.kpisByCohort()` + `KpiSummaryResponse.CohortKpi.tryOnStarted` | `GET /api/admin/kpis` 按 cohort 输出 `views→tryOnStarted→addToCart→checkoutInitiated→ordersPaid` |
| 材质/UV 自动审计（非阻断） | `worker/validator.py::validate_material_and_uv` + `worker/main.py`（`MATERIAL_AUDIT` 日志行） | 每件绑定输出打印 `has_material`/`has_texcoord`，用于"无纹理占比"基线 |

**重要**：材质检查是**咨询式**，未接入 `validate_rigged_glb` 失败链——当前 python 绑定输出本就无材质（B1 材质恢复属 Phase 1），硬校验会拒绝全部绑定任务。B1 落地后可将其升级为硬校验。

---

## 2. 根因实机验证（待运行时采集）

**目的**：确认"生产绑定路径是否丢失服装材质/UV，渲染成灰白外壳"（此前仅代码推断）。

**运行方法**：
```bash
# 需 rigging 容器（含 libigl + robust-laplacian）+ SMPL-X 模型文件
docker compose --profile rigging up rigging-worker
# 对一件“带贴图”的服装触发绑定：
#   POST /api/designer/products/{id}/rigging  （DESIGNER 角色）
# 或直接向 rigging_tasks 插 PENDING 行（input_payload 须含 source_glb_url + slot_hint）
# 观察 worker 日志中的 MATERIAL_AUDIT 行，并在前端 AvatarViewer 渲染输出 GLB 肉眼判定
grep MATERIAL_AUDIT <worker-logs>
```

**结论**（待填）：

| 项 | 结果 |
|----|------|
| 绑定输出 GLB `has_material` | ☐ true / ☐ false |
| 绑定输出 GLB `has_texcoord` | ☐ true / ☐ false |
| 前端渲染观感 | ☐ 灰白塑料外壳 / ☐ 保留贴图 |
| **根因结论** | ☐ 确认丢材质（→ B1 必要） / ☐ 未丢材质（→ 重排优先级） |

> 代码侧强证据（已确认，无需运行时）：`skinned_glb_writer.py:251-254` 只写 `POSITION/NORMAL/JOINTS_0/WEIGHTS_0`，`GLTF2(...)` 无 `materials/textures/images/samplers`；`python_rigging_provider.py:177` 用 `trimesh.load(force="mesh")` 只取 `vertices/faces/vertex_normals`，丢弃 UV/材质。→ 强烈支持"丢材质"假设；`validate_material_and_uv` 提供自动确认。

---

## 3. "无纹理服装"渲染占比基线（待采集）

**方法**：对一批既有/新绑定产物统计 `MATERIAL_AUDIT` 日志中 `has_material=false` 的占比。

| 指标 | 样本量 N | 结果 |
|------|---------|------|
| `has_material=false` 占比 | ☐ | ☐ % |
| `has_texcoord=false` 占比 | ☐ | ☐ % |

目标（PRD）：Phase 1 B1 后降至 **~0%**。

---

## 4. 穿模发生率基线（待采集，人工抽样）

**方法**：Phase 3（A1 几何 push-out）前无自动穿模检测。用人工抽样评分表建立基线：随机 N 件 × 3 姿势，0–3 分穿模严重度（0=无、1=轻微露肉、2=明显穿透、3=严重）。

| 严重度 | 计数 | 占比 |
|--------|------|------|
| 0（无穿模） | ☐ | ☐ |
| 1（轻微） | ☐ | ☐ |
| 2（明显） | ☐ | ☐ |
| 3（严重） | ☐ | ☐ |

目标（PRD）：Phase 3 后穿模发生率 **-50%**。

---

## 5. 转化漏斗基线（待采集，部署后）

**方法**：部署含 `TRYON_STARTED` 埋点的版本后，以 ADMIN 拉 `GET /api/admin/kpis`，记录各 cohort 计数（`ANALYTICS_ENABLED=true`，默认 cohorts=`control,variant`）。

| cohort | views | tryOnStarted | addToCart | checkoutInitiated | ordersPaid | conversionRate |
|--------|-------|--------------|-----------|-------------------|-----------|----------------|
| control | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| variant | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

> 说明：Phase 0 只让漏斗可测。把 cohort 绑定到"新旧渲染变体"、做前后/A-B 对比属 Phase 4。时间窗对比用既有 `analytics_events.created_at`（`idx_events_created` 索引），无需额外改动。
> 约束：`POST /api/events` 需鉴权 → 试穿事件仅登录用户落库（cohort 需 userId）。游客试穿埋点明确不在 Phase 0 范围。

---

## 附：文档漂移（发现但不属本 PR 修复范围）

- PRD 与根 `CLAUDE.md` 称"当前代码库无 analytics 埋点" → **过时**：自 `V14__analytics_events_and_cohorts.sql`（Phase 9）起已有完整 events+cohorts 栈。
- 根 `CLAUDE.md` 迁移写"V1–V17" → 实际到 **V20**。
- web `CLAUDE.md` 称 token key 为 `iyae_token` → 实际 `clossette_token`（`web/lib/api.ts`）。
