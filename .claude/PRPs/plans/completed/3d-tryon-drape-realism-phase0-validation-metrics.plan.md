# Plan: 3D 试穿垂坠真实感 — Phase 0(验证与度量地基)

## Summary
在动任何渲染/绑定代码之前，先让 Phase 0 做两件事：(1) **实机验证根因** —— 跑生产绑定路径 `RIGGING_PROVIDER=python`，确认绑定输出的服装是否真的丢失材质/UV（渲染成灰白外壳）；(2) **搭建可测的转化漏斗** —— 复用仓库**已存在**的 first-party analytics 栈（`analytics_events` 表 + `POST /api/events` + `useTrackEvent`），补上唯一缺失的一环 **`TRYON_STARTED` 试穿会话事件**，并把它接入 `GET /api/admin/kpis` 的 cohort 漏斗，让 `views → tryOnStarted → addToCart → checkoutInitiated → ordersPaid` 可按 cohort 读数。同时给 worker validator 加一个**非阻断**的"服装 GLB 是否含 material + TEXCOORD_0"自动审计，产出"无纹理服装占比"基线。

> ⚠️ **PRD 前提修正**：PRD 与根目录 CLAUDE.md 都称"当前代码库无 analytics 埋点" —— **该判断已过时**。仓库自 Phase 9（`V14__analytics_events_and_cohorts.sql`）起已有完整的 events + cohorts 垂直切片（server + web）。Phase 0 的埋点工作是**扩展**它，不是新建。本计划据此收敛了范围。

## User Story
作为 **IYAE 的产品负责人**，我想在投入任何真实感修复前，先确认"绑定丢材质"是否真的发生、并让"试穿→加购"漏斗按实验 cohort 可读数，这样我就能**用数据判断根因、避免盲改**，并为后续 Phase 1–3 的 A/B 建立可信基线。

## Problem → Solution
**现状**：垂坠不真实伤害转化只是定性判断；"绑定丢材质渲染成灰白"只是**代码推断**（写出端 `skinned_glb_writer.py` 只写 POSITION/NORMAL/JOINTS_0/WEIGHTS_0，载入端 `python_rigging_provider.py:177` 用 `trimesh.load(force="mesh")` 压平场景）；试穿会话在漏斗里**完全不可见**（`EventType` 无 TRY_ON 类别）。
**目标**：根因有实机结论；漏斗含试穿阶段且可按 cohort 读数；"无纹理服装占比"有自动化基线数字入库/入日志。

## Metadata
- **Complexity**: Medium（跨 server/web/worker 三模块，全部沿用既有模式，约 11–13 个文件，无新表/无新迁移）
- **Source PRD**: `.claude/PRPs/prds/3d-tryon-garment-drape-realism.prd.md`
- **PRD Phase**: Phase 0 — 验证与度量地基
- **Estimated Files**: ~12（server 5、web 3、worker 3、docs 1）

---

## UX Design

### Before
```
┌─────────────────────────────────────────────┐
│ 买家在 PDP 点"试穿" → SmartARViewer 内联挂载  │
│ 3D avatar + 服装载入（可能灰白/穿模）         │
│ 旋转查看 → 点"加入购物车"                      │
│                                               │
│ 埋点视角：VIEW ✓  ADD_TO_CART ✓               │
│           试穿会话 ✗（完全不可见）            │
│ 根因："绑定丢材质"仅代码推断，未实机验证       │
└─────────────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────────────┐
│ 同一买家流程，画面无可见变化（Phase 0 不改渲染）│
│                                               │
│ 埋点视角：VIEW ✓  TRYON_STARTED ✓(新)         │
│           ADD_TO_CART ✓                       │
│ /api/admin/kpis 漏斗(按 cohort)：             │
│   views → tryOnStarted → addToCart            │
│         → checkoutInitiated → ordersPaid      │
│ worker 日志：每件绑定 GLB 打印                 │
│   has_material / has_texcoord（无纹理占比基线）│
│ 根因：validate_material_and_uv 自动确认        │
└─────────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| PDP 试穿挂载 | 无埋点 | 模型就绪时发 `TRYON_STARTED`（每次挂载一次） | 仅认证用户落库（`/api/events` 需鉴权） |
| Admin KPI | 漏斗缺试穿阶段 | `CohortKpi` 新增 `tryOnStarted` 字段 | 复用既有聚合，无新查询 |
| 买家可见体验 | —— | **无变化** | Phase 0 是纯度量，不动渲染/绑定输出 |

---

## Mandatory Reading

实现前**必须**读的文件（按优先级）：

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `server/src/main/java/com/iyae/entity/enums/EventType.java` | all | 要新增的枚举值落点；`event_type` 列是 `VARCHAR(32)`，加枚举值**无需迁移** |
| P0 | `server/src/main/java/com/iyae/service/AnalyticsService.java` | 66–128 | `record(...)` 最佳努力写入 + `kpisByCohort()` 聚合；`tryOnStarted` 从既有 counts map 读取 |
| P0 | `server/src/main/java/com/iyae/dto/KpiSummaryResponse.java` | 9–29 | `CohortKpi` record，要在 `views` 后插入 `tryOnStarted` |
| P0 | `server/src/main/java/com/iyae/controller/AnalyticsController.java` | 23–38 | `POST /api/events` 接收端；client `type` 会 `toUpperCase()` 后 `EventType.valueOf` |
| P0 | `worker/validator.py` | 222–299 | `validate_rigged_glb` 编排 + `validate_skin_metadata` 的 primitive 遍历（新检查的镜像模板） |
| P0 | `worker/main.py` | 204–264 | 绑定任务循环；新审计在 `validate_glb_geometry` 之后、`complete_task` 之前打印 |
| P1 | `web/components/AvatarViewer.tsx` | 1–20, 190–235 | props 接口 + `hasContent` 早返回 + `useProgress`；`TRYON_STARTED` 发射点 |
| P1 | `web/app/products/[id]/page.tsx` | 113–116, 149–152, 400–415 | `useTrackEvent` 用法 + VIEW 的 ref 守卫模式（要镜像）+ SmartARViewer 挂载点 |
| P1 | `web/components/SmartARViewer.tsx` | 22–95 | desktop 路径渲染 AvatarViewer；要转发 `trackingContext` |
| P1 | `web/lib/hooks/useTrackEvent.ts` | all | 稳定 `track` 函数；fire-and-forget，永不抛错 |
| P2 | `worker/providers/skinned_glb_writer.py` | 251–274 | 确认只写 4 个属性、无 material/TEXCOORD（根因证据 + Phase 1 落点） |
| P2 | `worker/providers/python_rigging_provider.py` | 168–184 | `trimesh.load(force="mesh")` 丢 UV/材质（根因证据） |
| P2 | `server/src/test/java/com/iyae/service/AnalyticsServiceTest.java` | 99–116 | `kpisByCohort_computesConversionRate` —— 要更新的测试 |
| P2 | `server/src/test/java/com/iyae/controller/AnalyticsControllerTest.java` | 45–90 | WebMvcTest + `@WithMockUser` + `.with(csrf())` 模式 |
| P2 | `worker/tests/test_validator.py` | 194–274, 412–451 | 新 validator 测试的镜像（mock GLTF2 与真 trimesh box 两种） |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| glTF material / TEXCOORD 结构 | pygltflib README / glTF 2.0 spec（如需查阅用 context7 `resolve-library-id "pygltflib"`） | `primitive.attributes.TEXCOORD_0` 是 UV accessor 索引；`primitive.material` 指向 `gltf.materials[]`；两者都缺 = 无纹理 |
| SMPL-X 模型文件 | 已在仓库 worker 侧（`SMPLX_MODELS_PATH`，默认 `./smplx_models`） | 跑 `RIGGING_PROVIDER=python` 需模型文件存在，否则 `_load_smplx_avatar` 抛 `RiggingError` |

> 结论：**无需重外部研究** —— Phase 0 全部基于仓库既有内部模式（events 栈、validator 栈、rigging 栈）。glTF 结构用 pygltflib 既有对象即可。

---

## Patterns to Mirror

以下均为**仓库现存代码**，按此照抄，新增代码应与既有代码不可区分。

### EVENT_ENUM — 新增枚举值（无需迁移）
```java
// SOURCE: server/src/main/java/com/iyae/entity/enums/EventType.java:7-13
public enum EventType {
    VIEW,
    ADD_TO_CART,
    CHECKOUT_INITIATED,
    ORDER_PAID,
    ORDER_RETURNED
}
// event_type 列 = VARCHAR(32) + @Enumerated(EnumType.STRING)（AnalyticsEvent.java:34-36）
// → 加值只改枚举，DB 不动。列宽 32 足够 "TRYON_STARTED"(13)。
```

### KPI_AGGREGATE — 从既有 counts map 读事件计数
```java
// SOURCE: server/src/main/java/com/iyae/service/AnalyticsService.java:108-119
for (Map.Entry<String, EnumMap<EventType, Long>> e : byCohort.entrySet()) {
    EnumMap<EventType, Long> counts = e.getValue();
    long views = counts.getOrDefault(EventType.VIEW, 0L);
    long addToCart = counts.getOrDefault(EventType.ADD_TO_CART, 0L);
    long initiated = counts.getOrDefault(EventType.CHECKOUT_INITIATED, 0L);
    long paid = counts.getOrDefault(EventType.ORDER_PAID, 0L);
    long returned = counts.getOrDefault(EventType.ORDER_RETURNED, 0L);
    double conversion = initiated > 0 ? (double) paid / initiated : 0.0;
    double returnRate = paid > 0 ? (double) returned / paid : 0.0;
    cohortKpis.add(new KpiSummaryResponse.CohortKpi(
            e.getKey(), views, addToCart, initiated, paid, returned, conversion, returnRate));
}
// countByCohortAndEventType() 已返回该 cohort 全部事件类型 → 直接多读一个 bucket，无新查询。
```

### RESPONSE_RECORD — 嵌套 KPI record
```java
// SOURCE: server/src/main/java/com/iyae/dto/KpiSummaryResponse.java:13-22
public record CohortKpi(
    String cohort,
    long views,
    long addToCart,
    long checkoutInitiated,
    long ordersPaid,
    long ordersReturned,
    double conversionRate,
    double returnRate
) {}
```

### WEB_TRACK — VIEW 的 ref 守卫单发模式（镜像给 TRYON_STARTED）
```tsx
// SOURCE: web/app/products/[id]/page.tsx:113-116, 149-152
const track = useTrackEvent();
const viewedProductId = useRef<number | null>(null);
// ...在数据就绪后：
if (viewedProductId.current !== p.id) {
  viewedProductId.current = p.id;      // StrictMode 双挂载安全：ref 去重
  track({ type: "VIEW", productId: p.id });
}
```

### WEB_TRACK_HELPER — fire-and-forget，永不抛错
```ts
// SOURCE: web/lib/api.ts:78-84 + web/lib/hooks/useTrackEvent.ts:11-15
export const analytics = {
  track: (payload: TrackEventPayload): void => {
    void api.post("/api/events", payload).catch(() => { /* swallow */ });
  },
};
// payload: { type: string; productId?: number; sizeBracket?: string; metadata?: string }
```

### VALIDATOR_ITER — primitive 属性遍历（镜像给 material/UV 检查）
```python
# SOURCE: worker/validator.py:283-297（validate_skin_metadata 内）
has_joints = False
has_weights = False
for mesh in (gltf.meshes or []):
    for prim in (mesh.primitives or []):
        attrs = prim.attributes
        if hasattr(attrs, "JOINTS_0") and attrs.JOINTS_0 is not None:
            has_joints = True
        if hasattr(attrs, "WEIGHTS_0") and attrs.WEIGHTS_0 is not None:
            has_weights = True
if not has_joints:
    errors.append("No mesh primitive has JOINTS_0 attribute")
if not has_weights:
    errors.append("No mesh primitive has WEIGHTS_0 attribute")
return {"valid": len(errors) == 0, "errors": errors}
```

### VALIDATOR_TEST — 两种 GLB 构造法
```python
# SOURCE: worker/tests/test_validator.py:261-274（mock GLTF2）
path = _make_valid_glb_file()
try:
    gltf = _make_mock_gltf(skins=[...], meshes=[...])
    with patch("pygltflib.GLTF2") as MockGLTF2:
        MockGLTF2.load.return_value = gltf
        result = validate_rigged_glb(path)
    assert result["valid"]
finally:
    os.unlink(path)

# SOURCE: worker/tests/test_validator.py:437-451（真 trimesh box → 真 GLB）
box = trimesh.creation.box(extents=(0.4, 1.0, 0.3))
f.write(box.export(file_type="glb"))
# 断言风格：assert not result["valid"]; assert any("substr" in e for e in result["errors"])
```

### SERVICE_TEST — Mockito 手工构造 service
```java
// SOURCE: server/src/test/java/com/iyae/service/AnalyticsServiceTest.java:31-34, 100-116
private AnalyticsService service(boolean enabled) {
    return new AnalyticsService(eventRepository, cohortRepository,
            new AnalyticsProperties(enabled, List.of("control", "variant")));
}
// kpis 测试用 new Object[]{"control", EventType.X, 2L} 喂 countByCohortAndEventType()
```

### CONTROLLER_TEST — WebMvcTest 鉴权模式
```java
// SOURCE: server/src/test/java/com/iyae/controller/AnalyticsControllerTest.java:29-63
@WebMvcTest(AnalyticsController.class)
@Import(WebMvcSecurityConfig.class)
class AnalyticsControllerTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean AnalyticsService analyticsService;
    @MockBean UserRepository userRepository;

    @Test @WithMockUser(username = "test@example.com")
    void track_validEvent_returns202() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(
                User.builder().id(1L).email("test@example.com").role(Role.BUYER).build()));
        String body = objectMapper.writeValueAsString(
                new TrackEventRequest("view", 5L, null, null));
        mockMvc.perform(post("/api/events").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isAccepted());
        verify(analyticsService).record(eq(1L), any(), eq(5L), isNull(), isNull(), isNull());
    }
}
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `server/.../entity/enums/EventType.java` | UPDATE | 新增 `TRYON_STARTED` |
| `server/.../dto/KpiSummaryResponse.java` | UPDATE | `CohortKpi` 加 `long tryOnStarted`（`views` 之后） |
| `server/.../service/AnalyticsService.java` | UPDATE | `kpisByCohort()` 读 `TRYON_STARTED` 计数并传入 `CohortKpi` |
| `server/.../test/.../service/AnalyticsServiceTest.java` | UPDATE | 更新 `CohortKpi` 断言 + 加一条 tryOn 计数用例 |
| `server/.../test/.../controller/AnalyticsControllerTest.java` | UPDATE | 加"`TRYON_STARTED` → 202"用例 |
| `web/components/AvatarViewer.tsx` | UPDATE | 加 `trackingContext` prop + ref 守卫的 `TRYON_STARTED` 发射 |
| `web/components/SmartARViewer.tsx` | UPDATE | 加 `trackingContext` prop 并转发给 desktop 路径的 AvatarViewer |
| `web/app/products/[id]/page.tsx` | UPDATE | 给 SmartARViewer 传 `trackingContext={{ productId, surface: "pdp" }}` |
| `worker/validator.py` | UPDATE | 新增 `validate_material_and_uv(file_path)`（咨询式，不进 `validate_rigged_glb` 失败链） |
| `worker/main.py` | UPDATE | 绑定循环里**非阻断**调用并打印 `has_material`/`has_texcoord` 审计行 |
| `worker/tests/test_validator.py` | UPDATE | `validate_material_and_uv` 正/负用例 |
| `docs/phase0-drape-realism-findings.md` | CREATE | 记录根因实机结论 + 穿模/无纹理基线数字 + 漏斗基线读数 |

## NOT Building

- **游客试穿事件**：`POST /api/events` 需鉴权（`AnalyticsController` 无 null-guard 且不在 `/api/public/**`）。cohort 需 userId，A/B 面向登录用户。游客试穿埋点**明确不做**（若日后需要，镜像 `GuestAvatarController` 加 `/api/public/events`）。
- **任何渲染/绑定输出的实质改动**：B1 恢复材质/UV、D1 阴影、A1 防穿模全在 Phase 1–3。Phase 0 **只度量、不改观感**。material/UV 检查是**非阻断**的（当前 python 绑定输出本就无材质，硬校验会拒绝全部任务、搞垮管线）。
- **新表 / 新 Flyway 迁移**：加枚举值用现有 `VARCHAR(32)` 列，零迁移。当前最高迁移是 **V20**（CLAUDE.md 写的 V17 已过时）。
- **admin KPI 前端仪表盘 UI**：`GET /api/admin/kpis` 返回的 JSON 即"可读漏斗"，Phase 0 不做 UI。
- **AR/iOS 路径（ModelViewer/ARViewer）的试穿埋点**：Phase 0 只覆盖 desktop R3F（AvatarViewer）路径；移动 AR 会话埋点记为已知缺口，留后置。
- **自动穿模检测**：几何 push-out 后的自碰撞计数属 Phase 3（A1）。Phase 0 的穿模基线用**人工抽样评分 + 评分表**建立。
- **按用户路径归因"加购发生在试穿之后"**：Phase 0 用 **cohort 聚合漏斗**（tryOnStarted 计数 vs addToCart 计数，cohort=渲染变体）即可支撑 A/B；逐用户 session 关联留 Phase 4。

---

## Step-by-Step Tasks

### Task 1: 新增 `TRYON_STARTED` 事件类型
- **ACTION**: 在 `EventType` 枚举加一个常量。
- **IMPLEMENT**: 在 `ORDER_RETURNED` 之后加 `TRYON_STARTED`（或按漏斗顺序放 `VIEW` 之后——枚举顺序不影响存储，选可读顺序即可）。
- **MIRROR**: `EVENT_ENUM`（EventType.java:7-13）。
- **IMPORTS**: 无。
- **GOTCHA**: **不要**建迁移。列是 `VARCHAR(32)` + `@Enumerated(STRING)`，只存枚举名。client 发 `"TRYON_STARTED"`，`AnalyticsController` 会 `trim().toUpperCase()` 后 `EventType.valueOf`。
- **VALIDATE**: `./gradlew compileJava` 通过；`EventType.valueOf("TRYON_STARTED")` 不抛错。

### Task 2: `CohortKpi` 增加 `tryOnStarted` 字段
- **ACTION**: 在 `KpiSummaryResponse.CohortKpi` record 的 `views` 之后插入 `long tryOnStarted`。
- **IMPLEMENT**: `record CohortKpi(String cohort, long views, long tryOnStarted, long addToCart, long checkoutInitiated, long ordersPaid, long ordersReturned, double conversionRate, double returnRate) {}`。
- **MIRROR**: `RESPONSE_RECORD`（KpiSummaryResponse.java:13-22）。
- **GOTCHA**: record 是**位置参数**——插入新字段会改变构造顺序，Task 3 与两处测试的 `new CohortKpi(...)` 都要同步。放在 `views` 后是漏斗自然顺序（views→tryOn→cart）。
- **VALIDATE**: `./gradlew compileJava`（会因 AnalyticsService 调用点参数不匹配而报错，Task 3 修复）。

### Task 3: `kpisByCohort()` 填充 `tryOnStarted`
- **ACTION**: 在聚合循环里读 `TRYON_STARTED` 计数并传给 `CohortKpi`。
- **IMPLEMENT**: 在 `long views = ...` 后加 `long tryOnStarted = counts.getOrDefault(EventType.TRYON_STARTED, 0L);`，并把 `new CohortKpi(e.getKey(), views, tryOnStarted, addToCart, initiated, paid, returned, conversion, returnRate)`。
- **MIRROR**: `KPI_AGGREGATE`（AnalyticsService.java:108-119）。
- **GOTCHA**: `countByCohortAndEventType()`（AnalyticsEventRepository.java:18-20）已按 cohort×eventType 分组返回**全部**类型，`TRYON_STARTED` 自动在内——**无需新查询/新迁移**。`byCohort` 已用配置 cohort 预 seed，零事件 cohort 也会出现（值 0）。
- **VALIDATE**: `./gradlew compileJava` 通过。

### Task 4: 前端从 AvatarViewer 发射 `TRYON_STARTED`
- **ACTION**: 给 `AvatarViewer` 加可选 `trackingContext` prop，并在模型内容就绪时**每次挂载发一次**。
- **IMPLEMENT**:
  1. props 接口加 `trackingContext?: { productId?: number; surface?: string };`，并在解构参数里加 `trackingContext`。
  2. 顶层（在 `if (!hasContent) return null;` **之前**，满足 hooks 规则）加：
     ```tsx
     const track = useTrackEvent();
     const trackedRef = useRef(false);
     useEffect(() => {
       if (!hasContent || trackedRef.current) return;
       trackedRef.current = true;
       track({
         type: "TRYON_STARTED",
         productId: trackingContext?.productId,
         metadata: JSON.stringify({ surface: trackingContext?.surface ?? "unknown" }),
       });
     }, [hasContent, track, trackingContext]);
     ```
  3. `import { useEffect, useRef } from "react"` 已在（当前已 import `useEffect, useMemo, useRef, useState`）；加 `import { useTrackEvent } from "@/lib/hooks/useTrackEvent";`。
- **MIRROR**: `WEB_TRACK`（products/[id]/page.tsx:149-152 的 ref 单发）+ `WEB_TRACK_HELPER`。
- **GOTCHA**: `AvatarViewer` 在 `!hasContent` 时早返回 null——tracking `useEffect` 必须在早返回**之前**声明（React hooks 规则），用 `hasContent` 守卫 effect 体。`track` 是 `useCallback` 稳定引用，可安全进依赖数组。`analytics.track` 自身 fire-and-forget（`typeof window` 已在 api.ts 守卫），永不抛错、不阻塞渲染。ssr:false 动态导入 → 只在客户端跑。
- **VALIDATE**: `cd web && npx tsc --noEmit` 无类型错误（见校验命令）。

### Task 5: SmartARViewer 转发 `trackingContext`
- **ACTION**: 给 `SmartARViewerProps` 加 `trackingContext?: { productId?: number; surface?: string };`，desktop 路径转发给 `AvatarViewer`。
- **IMPLEMENT**: 解构里加 `trackingContext`；末尾 `return <AvatarViewer glbUrls={effectiveGlbUrls} riggedGarmentUrls={...} previewImageUrl={previewImageUrl} trackingContext={trackingContext} />`。
- **MIRROR**: SmartARViewer.tsx:33-95 现有 prop 转发风格。
- **GOTCHA**: AR/iOS 路径（`ARViewer`/`ModelViewerComponent`）**不**转发——Phase 0 只覆盖 desktop R3F 路径（见 NOT Building）。不改 `useARSupport` 路由逻辑。
- **VALIDATE**: `npx tsc --noEmit`。

### Task 6: PDP 传入 `trackingContext`
- **ACTION**: 在 PDP 的 SmartARViewer 挂载处传 `trackingContext`。
- **IMPLEMENT**: `<SmartARViewer glbUrls={[glbUrl]} usdzUrl={usdzUrl} previewImageUrl={product.media?.[0]} trackingContext={{ productId: product.id, surface: "pdp" }} />`（products/[id]/page.tsx:400-415 附近）。
- **MIRROR**: 同文件已有的 `SmartARViewer` 用法 + `track` 用法。
- **GOTCHA**: PDP 是唯一同时有"试穿 + 加购"的界面 → 是 MVP 漏斗的核心。其余试穿宿主（outfit view / OutfitCard / TryOnSection）无需改动：AvatarViewer 无 `trackingContext` 时仍发 `TRYON_STARTED`（surface="unknown"），作为额外基线计数。
- **VALIDATE**: `npx tsc --noEmit`；手动：PDP 打开试穿，Network 面板见 `POST /api/events`，body `type:"TRYON_STARTED"`（登录态）。

### Task 7: worker 新增 `validate_material_and_uv`（咨询式）
- **ACTION**: 在 `worker/validator.py` 加一个检查函数，判断 GLB 的 mesh primitive 是否含 `TEXCOORD_0` 与 material。
- **IMPLEMENT**:
  ```python
  def validate_material_and_uv(file_path: str) -> dict:
      """Advisory check: does this GLB carry UVs (TEXCOORD_0) + material?
      Non-blocking — used for the Phase 0 'untextured garment' baseline, NOT to reject tasks."""
      import pygltflib
      try:
          gltf = pygltflib.GLTF2.load(file_path)
      except Exception as e:
          return {"valid": False, "has_texcoord": False, "has_material": False,
                  "errors": [f"Failed to parse GLB: {e}"]}
      has_texcoord = False
      has_material = False
      for mesh in (gltf.meshes or []):
          for prim in (mesh.primitives or []):
              attrs = prim.attributes
              if getattr(attrs, "TEXCOORD_0", None) is not None:
                  has_texcoord = True
              if prim.material is not None:
                  has_material = True
      errors = []
      if not has_texcoord:
          errors.append("No mesh primitive has TEXCOORD_0 (UV) attribute")
      if not has_material:
          errors.append("No mesh primitive references a material")
      return {"valid": has_texcoord and has_material,
              "has_texcoord": has_texcoord, "has_material": has_material, "errors": errors}
  ```
- **MIRROR**: `VALIDATOR_ITER`（validator.py:283-297）+ 既有函数的 `{"valid":..., "errors":[...]}` 返回契约。
- **IMPORTS**: `pygltflib` **函数内惰性导入**（同 `validate_skin_metadata`）；已是 base 依赖（requirements.txt）。
- **GOTCHA**: **绝不**把它接进 `validate_rigged_glb` 的早返回链（validator.py:222-247）——那会让当前每件 python 绑定输出（本就无材质）都 `VALIDATION_FAILED`，绑定管线全挂。它是独立、咨询式函数，返回 `has_*` 供日志/基线用。
- **VALIDATE**: Task 9 的单测。

### Task 8: main.py 非阻断审计日志
- **ACTION**: 绑定任务成功校验后，调用 `validate_material_and_uv` 并打印结构化审计行（不影响任务成败）。
- **IMPLEMENT**: 在 `main.py` 绑定循环里 `validate_glb_geometry`（~line 240）之后、`complete_task` 之前：
  ```python
  from validator import validate_material_and_uv  # 或复用文件顶部 import
  mat = validate_material_and_uv(absolute_path)
  logger.info(
      "MATERIAL_AUDIT task=%s garment=%s has_material=%s has_texcoord=%s",
      task_id, garment_asset_id, mat["has_material"], mat["has_texcoord"],
  )
  ```
- **MIRROR**: main.py:204-264 现有 `logger.info`/校验调用风格。
- **GOTCHA**: 只 `log.info`，**不** raise、**不** `fail_task`。用固定前缀 `MATERIAL_AUDIT` 便于 grep 统计"无纹理占比" = `has_material=False` 行数 / 总行数。审计失败（解析异常）也只记日志，不影响 `complete_task`。
- **VALIDATE**: 手动跑一件绑定任务后 `grep MATERIAL_AUDIT` worker 日志见到该行（见 Manual Validation）。

### Task 9: worker validator 单测
- **ACTION**: 给 `validate_material_and_uv` 加正/负用例。
- **IMPLEMENT**:
  - 负例（当前绑定输出现状）：mock 一个 `gltf`，其 primitive `attributes.TEXCOORD_0 = None` 且 `material = None`，`patch("pygltflib.GLTF2")` 让 `.load` 返回它 → 断言 `not result["valid"]`、`not result["has_material"]`、`any("material" in e for e in result["errors"])`。
  - 正例：用真 `trimesh.creation.box(...)` 附带 `trimesh.visual.TextureVisuals(uv=..., material=...)` 导出 GLB → 断言 `result["has_texcoord"]`。若构造 UV 麻烦，正例也可用 mock：`prim.attributes.TEXCOORD_0 = 0`、`prim.material = 0` → 断言 `result["valid"]`。
- **MIRROR**: `VALIDATOR_TEST`（test_validator.py:261-274 与 437-451）；`try/finally: os.unlink(path)`。
- **GOTCHA**: 在 `worker/` 目录跑 pytest（`from validator import validate_material_and_uv` 才解析；无 conftest）。mock GLTF2 的 `attributes` 用 `MagicMock`，显式设 `TEXCOORD_0`/`material` 属性。
- **VALIDATE**: `cd worker && pytest tests/test_validator.py -q`。

### Task 10: 更新 `AnalyticsServiceTest`
- **ACTION**: 修 `kpisByCohort_computesConversionRate` 的 `CohortKpi` 断言，并加一条 `TRYON_STARTED` 计数用例。
- **IMPLEMENT**: 在既有 kpis 用例的 `countByCohortAndEventType()` stub 里加一行 `new Object[]{"control", EventType.TRYON_STARTED, 5L}`，断言 `control.tryOnStarted() == 5L`。（现有断言 `conversionRate == 0.5` 等仍成立。）
- **MIRROR**: `SERVICE_TEST`（AnalyticsServiceTest.java:100-116）。
- **GOTCHA**: 若不加 tryOn stub，`tryOnStarted()` 应 `== 0L`（getOrDefault）。位置参数变更后，任何直接 `new CohortKpi(...)` 的测试都要补新字段——全仓仅此聚合路径构造它。
- **VALIDATE**: `./gradlew test --tests '*AnalyticsServiceTest'`。

### Task 11: 更新 `AnalyticsControllerTest`
- **ACTION**: 加一条"client 发 `TRYON_STARTED` → 202 且 `record` 收到该类型"用例。
- **IMPLEMENT**: 镜像 `track_validEvent_returns202`，body 用 `new TrackEventRequest("TRYON_STARTED", 5L, null, "{\"surface\":\"pdp\"}")`，`verify(analyticsService).record(eq(1L), eq(EventType.TRYON_STARTED), eq(5L), isNull(), isNull(), eq("{\"surface\":\"pdp\"}"))`。
- **MIRROR**: `CONTROLLER_TEST`（AnalyticsControllerTest.java:45-63）。
- **GOTCHA**: 需 `.with(csrf())`；`@WithMockUser(username=...)`（缺失则测 403 匿名路径）。`type` 大小写不敏感（server `toUpperCase`）。
- **VALIDATE**: `./gradlew test --tests '*AnalyticsControllerTest'`。

### Task 12: 实机根因验证 + 基线文档（运营 + 交付物）
- **ACTION**: 跑生产绑定路径确认根因；建穿模/无纹理/漏斗基线；写入 `docs/phase0-drape-realism-findings.md`。
- **IMPLEMENT**:
  1. **根因**：起 `docker compose --profile rigging up rigging-worker`（compose 已设 `RIGGING_PROVIDER=python`；需 `libigl`+`robust-laplacian`（在 `Dockerfile.rigging`）+ `SMPLX_MODELS_PATH` 模型文件）。对一件**带贴图**的服装触发绑定：`POST /api/designer/products/{id}/rigging`（DESIGNER）或直接向 `rigging_tasks` 插 PENDING 行（`input_payload` 须含 `source_glb_url` + `slot_hint`）。在前端 AvatarViewer 渲染输出 GLB，肉眼确认是否灰白外壳；同时看 `MATERIAL_AUDIT` 日志行 `has_material`/`has_texcoord`。记录结论（是/否丢材质）。
  2. **无纹理占比基线**：对一批既有绑定产物跑 `validate_material_and_uv`（或统计 `MATERIAL_AUDIT` 日志），算 `has_material=False` 占比。
  3. **穿模基线**：定义抽样评分表（如随机 N 件 × 3 姿势，人工 0–3 分穿模严重度），记录当前分布（Phase 3 前无自动检测）。
  4. **漏斗基线**：部署后以 ADMIN 拉 `GET /api/admin/kpis`，记录各 cohort 的 `views/tryOnStarted/addToCart/...`（为 Phase 4 A/B 建基线）。
- **MIRROR**: worker `docker-compose.yml:81-108`（rigging-worker 服务）；server `RiggingController`/`RiggingService.requestRigging`。
- **GOTCHA**: 默认 `RIGGING_PROVIDER=mock`（StubRiggingProvider）**跳过整个绑定队列**（main.py:94/204）——必须 `python`（或 blender）才会 claim 任务。缺 SMPL-X 模型文件 → `_load_smplx_avatar` 抛 `RiggingError`。此任务多为运营/度量，产出是**书面结论**，非代码。
- **VALIDATE**: `docs/phase0-drape-realism-findings.md` 含四项结论且根因结论明确（是/否丢材质）。

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `AnalyticsControllerTest.track_tryonStarted_returns202` | `TrackEventRequest("TRYON_STARTED", 5L, null, "{...}")` + `@WithMockUser` | 202；`record(1L, TRYON_STARTED, 5L, null, null, metadata)` | 否 |
| `AnalyticsControllerTest.track_unknownType_returns400` | `type="NOT_REAL"` | 400 | 是（未知类型） |
| `AnalyticsControllerTest.track_unauthenticated_returns403` | 无 `@WithMockUser` | 403 | 是（匿名/游客不可埋点） |
| `AnalyticsServiceTest.kpis_includesTryOnStarted` | counts 含 `{control, TRYON_STARTED, 5}` | `control.tryOnStarted()==5` | 否 |
| `AnalyticsServiceTest.kpis_zeroTryOn_defaultsToZero` | 无 TRYON_STARTED 行 | `tryOnStarted()==0` | 是（缺值 getOrDefault） |
| `test_validator.validate_material_and_uv_missing` | primitive 无 TEXCOORD_0/material | `valid=False`、`has_material=False`、errors 含 "material" | 是（当前现状） |
| `test_validator.validate_material_and_uv_present` | primitive 有 TEXCOORD_0+material | `valid=True`、`has_texcoord=True` | 否 |
| `test_validator.validate_material_and_uv_parse_error` | 非法/空 GLB 路径 | `valid=False`、errors 含 "Failed to parse" | 是（解析失败不抛） |

### Edge Cases Checklist
- [x] 未知事件类型 → 400（既有行为，加回归）
- [x] 匿名请求 `/api/events` → 403（游客不可埋点，明确断言）
- [x] cohort 无 TRYON_STARTED 事件 → `tryOnStarted=0`（不缺行）
- [x] GLB 无 mesh/无 primitive → validator 不崩，报缺 material/UV
- [x] GLB 解析异常 → validator 返回 `valid=False` 而非 raise（不阻断 `complete_task`）
- [x] AvatarViewer 无 `trackingContext`（outfit/chat 宿主）→ 仍发 TRYON_STARTED，surface="unknown"
- [x] StrictMode 双挂载 → `trackedRef` 保证每次挂载只发一次

---

## Validation Commands

### Static Analysis
```bash
# server 编译
cd server && ./gradlew compileJava compileTestJava
# web 类型检查
cd web && npx tsc --noEmit
```
EXPECT: 零类型/编译错误

### Unit Tests
```bash
cd server && ./gradlew test --tests '*AnalyticsServiceTest' --tests '*AnalyticsControllerTest'
cd worker && pytest tests/test_validator.py -q
```
EXPECT: 全绿

### Full Test Suite
```bash
cd server && ./gradlew test          # JUnit 5（H2 自动 DDL，含新枚举值）
cd web && npm run test               # Vitest
cd worker && pytest                   # pytest（在 worker/ 目录）
```
EXPECT: 无回归

### Database Validation
```bash
# 无新迁移 —— 验证既有迁移仍在 V1..V20 且 H2 引导通过（全测试即覆盖）
ls server/src/main/resources/db/migration/   # 最高应为 V20
```
EXPECT: 无 V21；枚举值靠现有 VARCHAR(32) 列承载

### Browser Validation
```bash
./dev.sh start && ./dev.sh web        # 起服务 + 前端热重载
```
- [ ] 登录 → 进入某 PDP → 试穿区加载 → DevTools Network 见 `POST /api/events`，payload `type:"TRYON_STARTED"`, `productId`, `metadata:{"surface":"pdp"}`
- [ ] 以 ADMIN 拉 `GET /api/admin/kpis` → 每个 cohort 含 `tryOnStarted` 字段

### Manual Validation
- [ ] `docker compose --profile rigging up rigging-worker` 起动，日志无 `RIGGING_PROVIDER=mock` 跳过提示
- [ ] 触发一件带贴图服装绑定 → worker 日志出现 `MATERIAL_AUDIT task=... has_material=... has_texcoord=...`
- [ ] 前端渲染该绑定输出，肉眼判定是否灰白外壳，结论写入 findings 文档
- [ ] `docs/phase0-drape-realism-findings.md` 四项基线（根因 / 无纹理占比 / 穿模抽样 / 漏斗）齐全

---

## Acceptance Criteria
- [ ] `TRYON_STARTED` 枚举值可被 `POST /api/events` 接收并落库（202）
- [ ] `GET /api/admin/kpis` 的 `CohortKpi` 含 `tryOnStarted`，漏斗 `views→tryOnStarted→addToCart→checkoutInitiated→ordersPaid` 按 cohort 可读
- [ ] PDP 试穿加载时前端发 `TRYON_STARTED`（登录态，Network 可见）
- [ ] `validate_material_and_uv` 存在且为**非阻断**（不进 `validate_rigged_glb` 失败链）；worker 每件绑定打印 `MATERIAL_AUDIT`
- [ ] 根因有实机结论（是/否丢材质）+ 三项基线入库/入文档
- [ ] 所有校验命令通过、无回归、无类型/编译/lint 错误

## Completion Checklist
- [ ] 代码沿用既有模式（events 栈 / validator 栈 / rigging 栈）
- [ ] 错误处理匹配仓库风格（analytics best-effort swallow；validator 返回 dict 不 raise）
- [ ] 日志遵循仓库约定（`logger.info` + `MATERIAL_AUDIT` 前缀；client track fire-and-forget）
- [ ] 测试遵循既有模式（WebMvcTest/Mockito；pytest mock GLTF2 / 真 box）
- [ ] 无硬编码（surface 字符串走 prop；无新 magic 常量）
- [ ] 无新表/无新迁移（枚举值用现有列）
- [ ] 自包含 —— 实现期间无需再翻代码库

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| material/UV 检查误接进 `validate_rigged_glb` 失败链 → 拒绝全部当前绑定输出 | M | 高（绑定管线全挂） | 计划明确其为**独立咨询式**函数 + main.py 只 `log.info`；Task 7/8 GOTCHA 双重强调 |
| `CohortKpi` 位置参数插入字段漏改调用点/测试 | M | 中（编译/测试红） | Task 2/3/10 串联，字段固定插在 `views` 后；全仓仅一处构造 |
| 实机验证受阻（缺 SMPL-X 模型 / libigl / 无带贴图样品） | M | 中（根因结论延后） | 用 `docker compose --profile rigging`；`MATERIAL_AUDIT` 日志可在无人工渲染时先给自动结论 |
| 游客试穿事件被误期望纳入漏斗 | L | 低 | NOT Building 明确排除；`/api/events` 需鉴权，行为一致 |
| PRD/CLAUDE.md 的过时假设（"无 analytics"、"V17"）误导实现 | M | 中 | 计划顶部与 NOT Building 显式修正为"扩展既有栈 / 最高 V20" |

## Notes
- **文档漂移记录**（实现时留意，非本计划改动）：web `CLAUDE.md` 把 token key 写成 `iyae_*`，实际是 `clossette_token`（`web/lib/api.ts:20`）；根 `CLAUDE.md` 迁移写 V1–V17，实际到 V20；两处都称"无 analytics 埋点"，实际已有完整 events+cohorts 栈（V14）。建议后续 `/ccg:verify-change` 或 doc-sync 修正，但**不属 Phase 0 交付**。
- **A/B 前置**：Phase 0 只让漏斗可测；把 cohort 与"新旧渲染变体"绑定是 Phase 4 的事。时间窗对比（前后）用现有 `analytics_events.created_at` + `idx_events_created` 索引即可，Phase 0 无需改。
- **依赖链回顾**：本计划对应 PRD Implementation Phases 表的 **Phase 0（无依赖）**，是 Phase 1–5 的前置门槛。完成后建议把 PRD 该行 `pending → in-progress`（本计划已在下方标注引用）。
