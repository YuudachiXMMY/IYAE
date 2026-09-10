# Phase 0 — 3D 试穿垂坠真实感:验证与度量地基(Findings）

> 状态：**根因已实机确认（丢材质）；"无纹理占比"基线已采集（=100%）；穿模率/转化漏斗数值基线待 live+真人QA**
> 关联 PRD：`.claude/PRPs/prds/3d-tryon-garment-drape-realism.prd.md`（Phase 0）
> 关联计划：`.claude/PRPs/plans/completed/3d-tryon-drape-realism-phase0-validation-metrics.plan.md`

本 Phase 0 交付两类东西：
1. **可运行的度量机制**（已随本 PR 落地、已测试）——让根因可自动确认、让漏斗可读数。
2. **基线数字**——其中"无纹理占比"已通过**经验探针**在无头环境采集；穿模率与转化漏斗数值基线需真人视觉 QA / 已部署应用+真实流量，本环境无法采集（下方明确标注）。

## 采集方法（本次实际执行）

用仅含 base 依赖（trimesh + pygltflib + numpy + pillow，**无 SMPL-X / 无 libigl / 无 Docker**）的经验探针，跑**真实 worker 代码路径**并用 `validator.validate_material_and_uv` 测量材质/UV 是否留存。探针结论经一个 5-agent 验证工作流**对抗性核验**：3 个独立 refuter（load-end / write-end / pipeline-scope）+ 1 个漏斗可读性验证 + 1 个诚实性批判，全部 `refuted=false`、confidence=high。

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

## 2. 根因实机验证 —— ✅ 确认丢材质（empirical）

**目的**：确认"生产绑定路径是否丢失服装材质/UV，渲染成灰白外壳"。

**探针实测结果**（跑真实 worker 代码路径，`validate_material_and_uv` 测量）：

| 步骤 | 路径 | `has_material` | `has_texcoord` |
|------|------|:---:|:---:|
| ① 源服装（Meshy/设计师提供） | 手工带贴图 GLB | ✅ true | ✅ true |
| ② 载入端 `trimesh.load(path, force="mesh")` | python_rigging_provider.py:177 | （trimesh 对象**仍保留** uv/material） | （仍保留） |
| ③ 写出端 A `write_skinned_glb` | PythonRiggingProvider（生产） | ❌ false | ❌ false |
| ④ 写出端 B `StubRiggingProvider.generate` | 默认 rig provider | ❌ false | ❌ false |

**根因结论：✅ 确认丢材质。** 源服装携带 material+UV，但两条生产写出路径（python 与 stub）输出的 rigged GLB 均无 material/TEXCOORD_0。前端不注入材质（`AvatarViewer`/`FittingHelper` 只重绑骨架 + polygonOffset），three.js `GLTFLoader` 对无材质 GLB 套用 glTF 默认（白 baseColor、metalness=1、roughness=1）→ **灰白塑料外壳**。B1（恢复材质/UV）必要。

> **⚠️ 对 PRD 因果表述的经验修正**：PRD 称"`python_rigging_provider.py:177` 用 `trimesh.load(force="mesh")` 压平场景、丢掉 UV/材质"——归因不精确。探针步骤②实测：`trimesh.load(force="mesh")` 返回的 `Trimesh` **仍保留 uv 与 material**。真正的丢失在两处:(a) `_load_garment_glb`（python_rigging_provider.py:181-184）只提取 `(vertices, faces, vertex_normals)`、丢弃承载 UV+material 的 trimesh 对象;(b) `skinned_glb_writer.write_skinned_glb`（:252）只写 `POSITION/NORMAL/JOINTS_0/WEIGHTS_0`，无 TEXCOORD_0/material。故根因 = **抽取丢弃 + 写出不带**，非 load 调用本身压平。**B1 因此必须同时改两处**（provider 抽取要透传 UV/材质 + writer 要写 TEXCOORD_0/material）。

> **对抗性核验**：3 个独立 refuter 分别从 load-end / write-end / pipeline-scope 试图反驳,均 `refuted=false`、confidence=high。pipeline-scope 补充:Blender provider（`rig_garment.py` 经 `import_scene.gltf`/`export_scene.gltf` 默认导入导出材质）**确实保留材质**,但属 legacy/opt-in;默认+生产路径均丢——Blender 只**缩小**了"生产管线"措辞的范围,未反驳根因。

> **可复现的自动确认机制**（已随本 PR 落地）:`worker/validator.py::validate_material_and_uv` + `worker/main.py` 的 `MATERIAL_AUDIT` 日志行——真实 rigging 任务运行时会对每件输出打印 `has_material`/`has_texcoord`。如需容器内二次确认:`docker compose --profile rigging up rigging-worker`（需 libigl+robust-laplacian+SMPL-X），触发一件带贴图服装绑定后 `grep MATERIAL_AUDIT <worker-logs>`。

---

## 3. "无纹理服装"渲染占比基线 —— ✅ 已采集 = 100%（empirical）

**方法**：探针对两条生产写出路径的输出跑 `validate_material_and_uv`。

| 指标 | 结果 | 依据 |
|------|------|------|
| `has_material=false` 占比 | **100%** | python + stub 两条生产写出路径的输出**均**无 material |
| `has_texcoord=false` 占比 | **100%** | 同上，均无 TEXCOORD_0 |

**结论**：当前生产绑定写出路径产出的 rigged GLB **100% 无纹理**（结构性——写出端根本不写 material/UV，而非概率性丢失）。目标（PRD）：Phase 1 B1 后降至 **~0%**。B1 落地后可把 `validate_material_and_uv` 从咨询式升级为 `validate_rigged_glb` 的硬校验，把该占比作为回归门。

---

## 4. 穿模发生率基线 —— ⏳ 待采集（需真人视觉 QA，无头环境不可采）

**为何延后**：PRD 的 Success Metrics 明确该基线用"抽样 QA 评分（5 分制/人工视觉审查渲染场景）+ push-out 后自碰撞计数"。Phase 3（A1 几何 push-out）前**无自动穿模检测**，因此穿模基线**只能靠真人对渲染场景视觉评分**——本无头环境无法采集，不可伪造。

**采集方法（留待 live/QA 环境）**：随机 N 件 × 3 姿势，人工 0–3 分穿模严重度（0=无、1=轻微露肉、2=明显穿透、3=严重）。

| 严重度 | 计数 | 占比 |
|--------|------|------|
| 0（无穿模） | ⏳ | ⏳ |
| 1（轻微） | ⏳ | ⏳ |
| 2（明显） | ⏳ | ⏳ |
| 3（严重） | ⏳ | ⏳ |

目标（PRD）：Phase 3 后穿模发生率 **-50%**。

---

## 5. 转化漏斗基线 —— 机制✅可读（已验证）；数值基线 ⏳ 待部署+真实流量

**漏斗可读性：✅ 端到端验证通过。** 链路无断裂:客户端 `AvatarViewer` 发 `TRYON_STARTED`（ref 守卫单发，PDP 带 productId+surface）→ `POST /api/events` 接收并 `record()` → `AnalyticsService.kpisByCohort()` 按 cohort 聚合（`countByCohortAndEventType` GROUP BY 含 TRYON_STARTED）→ `GET /api/admin/kpis` 返回 `CohortKpi.tryOnStarted`。已由通过的 `AnalyticsServiceTest`（tryOnStarted==4L）+ `AnalyticsControllerTest`（TRYON_STARTED→202、kpis admin-only）覆盖。→ 满足 PRD"转化漏斗**可读数**/主指标可测"。

**数值基线 ⏳ 待采集**：读出各 cohort 的真实计数需**已部署应用 + 真实用户流量**，本环境无数据、不可伪造。

| cohort | views | tryOnStarted | addToCart | checkoutInitiated | ordersPaid | conversionRate |
|--------|-------|--------------|-----------|-------------------|-----------|----------------|
| control | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| variant | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

**已知覆盖缺口（非链路断裂，记录待后置修）**：
- 仅**桌面** `AvatarViewer` 路径 emit `TRYON_STARTED`;`SmartARViewer` 的 WebXR/iOS/Android(ARViewer/ModelViewer)分支未转发 `trackingContext` → **移动端试穿欠计**。
- **游客/未登录**试穿不入 cohort 聚合（`record()` 仅在 `userId≠null` 时归属 cohort,查询过滤 `cohort IS NOT NULL`）——**设计使然**（cohort 需 userId）。

> 说明：Phase 0 只让漏斗可测。把 cohort 绑定到"新旧渲染变体"、做前后/A-B 对比属 Phase 4。时间窗对比用既有 `analytics_events.created_at`（`idx_events_created` 索引），无需额外改动。

---

## 附：文档漂移（发现但不属本 PR 修复范围）

- PRD 与根 `CLAUDE.md` 称"当前代码库无 analytics 埋点" → **过时**：自 `V14__analytics_events_and_cohorts.sql`（Phase 9）起已有完整 events+cohorts 栈。
- 根 `CLAUDE.md` 迁移写"V1–V17" → 实际到 **V20**。
- web `CLAUDE.md` 称 token key 为 `iyae_token` → 实际 `clossette_token`（`web/lib/api.ts`）。
