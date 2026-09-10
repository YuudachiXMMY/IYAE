# 3D 试穿服装垂坠真实感(Garment Drape Realism)

> 靶心:让买家在 3D 试穿里看到的服装"像真的穿在身上",而不是贴纸/悬浮/穿模。
> 主指标:试穿后加购/转化。硬约束:复用现有 SMPL-X + weight transfer 管线,不训练新的 ML 模型。

## Problem Statement

买家在 IYAE 的 3D 试穿中看到的服装缺乏真实的垂坠与质感——服装像"贴纸/悬浮/穿模",没有褶皱、松紧和重力感,部分服装甚至渲染成"灰白塑料外壳"(丢失了商品贴图)。这直接削弱了试穿的可信度,让"看到即相信"的转化闭环失效——买家看完试穿仍不敢下单,试穿沦为花哨演示而非购买决策工具。

## Evidence

- **定性观察(用户/团队,主指标问题的现状)**:目前对"垂坠不真实伤害转化"是定性判断,**尚无量化数据**——退货率、试穿→加购转化、尺码客诉均未按"是否试穿/是否受垂坠影响"切分。→ *假设,需通过埋点 + A/B 验证(见 Phase 0)。*
- **技术根因证据(代码库,已定位,精确到 file:line)**:
  - 全仓无任何布料模拟 / 重力 / 碰撞 / 张力逻辑;绑定是纯线性混合蒙皮(LBS),服装顶点刚性跟最近骨骼 → 天生无褶皱、收缩包裹式外观(`worker/providers/weight_transfer.py`)。
  - **生产绑定路径丢材质**:`worker/providers/python_rigging_provider.py:177` 用 `trimesh.load(force="mesh")` 压平场景、丢掉 UV/材质;`worker/providers/skinned_glb_writer.py:252` 只写 `POSITION/NORMAL/JOINTS_0/WEIGHTS_0`,**无 TEXCOORD_0、无 material、无 texture** → 带纹理服装退化为默认灰白 `MeshStandardMaterial`。*(此点由写出端+载入端代码推断,尚未实机渲染验证——Phase 0 首要动作。)*
  - Meshy 生成 `enable_pbr=False`(`worker/providers/meshy_generator.py:223`)→ 只有漫反射底色,无法线/粗糙贴图,布料无微观起伏。
  - 防穿模只是深度欺骗:`web/components/FittingHelper.tsx:12-74` 仅设 `polygonOffset`,**不移动任何顶点** → 真穿模依然可见。
  - 无阴影:`web/components/AvatarViewer.tsx:265-280` 的 `<Canvas>` 未开 `shadows`,无接触阴影 → 大脑判定服装"飘着"。
  - 尺度贴合是 bbox 高度比启发式(`worker/providers/scale_normalizer.py:65-101`),非身形锚点对齐 → 整体"套上去"但不贴身。
- **市场基准(有来源)**:服装退货率 20-40%(全品类最高),主因即尺码/贴合;试穿用户转化约为不用者 2.3x、退货低约 38%;典型 VTO 带来转化 +10-25%、退货 -20-35%(厂商 case study,偏乐观,需自建同期 A/B 才可信)。

## Proposed Solution

采用**感知优先(perception-first)**路线:在**完全复用现有 SMPL-X + weight transfer 管线、不训练任何新 ML 模型**的前提下,先集中修复一批"低成本、高感知收益"的真实感硬伤——恢复绑定服装的 UV/材质、加接触阴影、打开 PBR、叠加品类法线贴图、把假的深度防穿模换成真几何 push-out。这批改动能把"贴纸/悬浮/塑料外壳/穿模"观感解决一大半,且几乎不碰核心算法。**离线布料仿真烘焙(真物理垂坠)复杂度高、耗时敏感,作为后置阶段,先用轻量项验证"垂坠真实感确实拉动转化"这一核心假设后再投入。**

之所以选这条路而非"直接上布料仿真":市场证据表明买家要的是**感知可信而非物理精确**(Google 用纯 2D 生成即可让用户觉得垂坠可信并规模化);技术证据表明最大的观感损失来自材质丢失/无阴影/穿模这些**非物理**问题,性价比远高于布料仿真。

## Key Hypothesis

我们相信:**恢复服装贴图 + 接触阴影 + 消除穿模 + plausible 褶皱(法线贴图)**,会让 3D 试穿对买家足够可信,从而**提升买家试穿后的加购/转化**。
当我们看到 **试穿会话→加购的转化率(相对未试穿或相对旧版试穿)出现统计显著提升**,同时 **穿模发生率与"无纹理服装"占比显著下降** 时,就知道我们做对了。

## What We're NOT Building

- **移动端实时布料仿真** —— 移动 web 上性能不可行(35k 顶点 XPBD 在数据中心级 GPU 才 8-10ms/帧),自碰撞是公认瓶颈,恐怖谷风险高。最多把"裙摆微飘"级粗粒度 Verlet 作为后置可选点缀,不进主路径。
- **2D 扩散生成式试穿** —— 与"复用 3D 管线、不训练新 ML"的硬约束直接冲突。
- **物理精确的逐姿势动态垂坠(v1)** —— 高复杂度,转化非必需;放到验证后的后置阶段(A2/A3)。
- **带用户真实五官/体型的高保真 avatar** —— 属于"avatar 像不像本人"这条独立问题线,本 PRD 不覆盖(见 Non-Users / Open Questions)。
- **重写绑定核心算法** —— 本 PRD 在现有权重转移管线上做增量,不重构 LBS 蒙皮方案。

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| 试穿后加购/转化(主指标) | 相对基线 **+10%**(先建基线再定最终目标) | 埋点:试穿会话 → add-to-cart 事件漏斗;新旧渲染 A/B 或前后对比 |
| 穿模发生率 | 显著下降(基线待测,目标 -50%) | 抽样 QA 评分 + 几何 push-out 后自碰撞检测计数 |
| "无纹理服装"渲染占比 | 从当前(疑似高)降至 **~0%** | Phase 0 实机审计 + 绑定输出 GLB 是否含 material/TEXCOORD 的自动校验 |
| 试穿真实感主观评分 | 提升(基线待测) | 小样本用户调研 5 分制("像不像真的穿上") |
| 尺码相关退货率(长期滞后指标) | 下降 | 退货原因归因,60-90 天窗口 |

> ⚠️ 主指标依赖**转化漏斗埋点**,当前代码库未见相应 analytics 埋点 → 埋点是可测量的前置依赖(Phase 0)。

## Open Questions

- [ ] **[验证优先]** 实机跑 `RIGGING_PROVIDER=python` 确认绑定输出的服装是否真的丢失材质/显示为灰白外壳(默认 provider 是 `mock`,需切到生产路径验证)。
- [ ] 当前是否有任何转化/试穿漏斗埋点?若无,埋点工作量多大?(主指标可测的前提)
- [ ] Meshy `enable_pbr=True` 的实际贴图质量与 credit 成本?是否稳定可用?
- [ ] Blender 布料仿真在 30k 面级别单件耗时?(决定 A2 是否可接受异步烘焙)
- [ ] "垂坠真实感"与"avatar 像不像本人"哪个对转化影响更大?(本 PRD 假设前者;若后者主导,优先级需重排)
- [ ] 品类法线贴图需要覆盖哪些面料(denim/knit/silk/…)?贴图资产从哪来(采购/程序化生成)?

---

## Users & Context

**Primary User**
- **Who**:IYAE 的买家 / 消费者,Gen Z 与年轻千禧一代(18-30 岁),对退货麻烦敏感、对"看起来假"的数字体验容忍度低、习惯移动端。
- **Current behavior**:浏览商品 → 进入 3D/AR 试穿 → 看到服装"贴纸/悬浮/穿模/灰白外壳" → 对"我穿上会怎样"没有信心 → 退出或凭尺码表赌一把下单(高退货风险)。
- **Trigger**:在 PDP 或聊天推荐里点"试穿",想在下单前确认"这件穿在我身上像不像样、合不合身"。
- **Success state**:试穿画面里服装有真实贴图、有褶皱与垂坠、不穿模、有落地阴影 → 买家"看到即相信" → 有信心加购下单。

**Job to Be Done**
当我(买家)看中一件衣服但不确定穿上效果时,我想在 3D 试穿里看到它**真实地穿在身上的样子**,这样我就能**有信心下单、不用靠退货来试错**。

**Non-Users**
- 设计师/卖家侧的绑定质量工具链(本 PRD 只关注买家可见的最终观感,不做设计师编辑器)。
- 追求"avatar 长得像本人"的用户诉求(独立问题线,本 PRD 假设它次要于垂坠观感)。
- 追求元宇宙/数字时装创意表达(如 DressX 式不受物理约束)的用户。

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | **恢复绑定服装的 UV + 材质/贴图**(B1) | 最便宜、视觉收益最大;直接修复"灰白塑料外壳"这一贴纸感最强来源 |
| Must | **接触阴影 + 柔和阴影**(D1) | 纯前端、极低成本,立刻消除"悬浮感" |
| Must | **转化漏斗埋点 + Phase 0 实机验证**(度量前置) | 没有埋点主指标不可测;没验证根因就是盲改 |
| Should | **几何 push-out 防穿模**(A1) | 复用 igl,把假深度欺骗换成真几何,消灭穿模——唯一直接击穿"真实感"的硬伤 |
| Should | **品类法线/褶皱贴图**(C2) | 零布料模拟"伪造"织物褶皱与质感;依赖 B1 提供 UV |
| Should | **打开 Meshy PBR**(C1) | 一行改动拿到法线/粗糙贴图;但需评估 credit 成本与质量 |
| Could | **兜底织物材质**(D2)、环境/色调映射微调(D3) | B1 落地前的过渡 + 弱化塑料高光 |
| Could | **尺度锚点贴合升级**(B3)、匹配鲁棒性/蒙皮平滑(B2) | 减少"整体套大一号"与大面积插值收拢 |
| Won't (v1) | **离线布料仿真烘焙**(A2)、姿势条件预垂坠(A3)、实时布料仿真 | 高复杂度/耗时敏感;转化非必需;先验证假设再投入 |

### MVP Scope

**MVP = Phase 0(验证+埋点) + Phase 1(感知快赢:B1 恢复材质/UV + D1 接触阴影 + D2 兜底材质)。**
这是验证核心假设("垂坠/质感真实感能拉动转化")的最小闭环:先确认根因、建立可测漏斗,再上最便宜的一批真实感修复,用 A/B 或前后对比看加购转化是否动。若动,再顺次投入防穿模(A1)、法线贴图(C2)、PBR(C1);若不动,则用最小代价证伪了"垂坠是转化瓶颈",避免误投布料仿真。

### User Flow

关键路径(买家视角,最短达成价值):
1. 买家在 PDP/聊天点"试穿" →(埋点:try-on 会话开始)
2. 3D 试穿加载:先 2D 商品图占位(已有)→ 3D avatar + **带真实贴图、有褶皱质感、有落地阴影、不穿模**的服装流式载入
3. 买家旋转/换姿势查看,建立"这件穿上像样且合身"的信心
4. 点"加入购物车" →(埋点:试穿→加购转化事件)

---

## Technical Approach

**Feasibility**: **HIGH**(针对 MVP / 感知快赢);**MEDIUM**(几何防穿模、法线贴图);**LOW-MEDIUM**(后置的离线布料仿真)。

**Architecture Notes**
- **完全复用现有管线**:image-to-3D(Meshy)→ materialize → weight transfer 绑定 → skinned GLB → R3F 前端摆姿势渲染。所有改动是增量。
- **B1(恢复材质)是杠杆点**:改 `python_rigging_provider.py:177` 的 trimesh 载入以保留 UV/材质 + 扩展 `skinned_glb_writer.py`(加 TEXCOORD_0 accessor + material/texture/image/sampler)。这也是后续 C2 法线贴图的前提(需 UV)。
- **A1 复用 igl**:`weight_transfer.py:40` 已在用 `igl.point_mesh_squared_distance`,可直接算服装顶点到身体的有向距离并沿法线 push-out,不引入新依赖;集成在 `python_rigging_provider.py` 绑定后、写出前。
- **D1 纯前端**:`AvatarViewer.tsx` 加 `<Canvas shadows>` + drei `<ContactShadows>` + 灯光 `castShadow`。
- **Blender 路径已存在**(`RIGGING_PROVIDER=blender`,`blender_rigging_provider.py` + `blender_scripts/rig_garment.py` 的 subprocess 框架现成,且该路径本就保留材质),是后置 A2 布料仿真的落点——但 `skinned_glb_writer` 目前**不支持 morph target**,A3 需先补齐。

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| "绑定丢材质"根因判断错误(实际有材质) | M | Phase 0 首要动作:实机跑 `RIGGING_PROVIDER=python` 渲染验证,再动手 |
| 主指标无埋点 → 无法证明转化提升 | H | Phase 0 建漏斗埋点;用 A/B 或前后对比 |
| Meshy PBR 质量不稳定 / credit 暴涨 | M | C1 先小范围实测;不达标则退回 C2 程序化法线贴图 |
| 法线贴图只造视觉褶皱、轮廓仍假 | M | 与 A1(几何防穿模)+ B3(锚点贴合)组合,保证轮廓/尺码先对 |
| SMPL-X + LBS 对宽松服装(裙/阔腿裤)天生蒙皮失败 | H | 宽松服装是已知难点;v1 优先合身类;宽松类的真垂坠留给后置 A2 |
| 布料仿真单件耗时不可接受 | M | 后置阶段先做耗时基准;异步烘焙 + 缓存;不达标不进主路径 |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently
  DEPENDS: phases that must complete first
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 0 | 验证与度量地基 | 实机验证"绑定丢材质"根因;搭试穿→加购转化埋点漏斗;建穿模/无纹理占比基线 | in-progress(根因已实机确认丢材质·经验探针+对抗核验;漏斗端到端可读且单测覆盖;"无纹理占比"基线=100%已入库;穿模率与转化漏斗数值基线待部署+真人QA采集) | - | - | [plan](../plans/completed/3d-tryon-drape-realism-phase0-validation-metrics.plan.md) · [report](../reports/3d-tryon-drape-realism-phase0-validation-metrics-report.md) · [findings](../../../docs/phase0-drape-realism-findings.md) |
| 1 | 感知快赢(MVP) | B1 恢复绑定 UV/材质 + D1 接触阴影 + D2 兜底织物材质 | complete(代码+单测落地:writer 写 TEXCOORD_0/material/内嵌贴图·metalness=0;viewer 接触阴影;untextured 兜底织物。实机渲染+MATERIAL_AUDIT 真值确认待 live/QA) | with 2 | 0 | [plan](../plans/completed/3d-tryon-drape-realism-phase1-perceptual-quickwins.plan.md) · [report](../reports/3d-tryon-drape-realism-phase1-perceptual-quickwins-report.md) |
| 2 | 质感增强 | C1 打开 Meshy PBR + C2 品类法线/褶皱贴图(依赖 B1 的 UV)+ D3 环境/色调映射 | pending | with 1 | 0, 1(C2 依赖 B1) | - |
| 3 | 几何防穿模 | A1 igl 有向距离 push-out,替代 FittingHelper 深度欺骗;可选 B3 锚点尺度贴合 | pending | - | 0 | - |
| 4 | 转化验证与决策门 | A/B 或前后对比评估 Phase 1-3 对加购转化的影响,决定是否投入布料仿真 | pending | - | 1, 2, 3 | - |
| 5 | 真垂坠(后置,门控) | A2 Blender 离线布料仿真烘焙(先做耗时基准);A3 姿势/尺码 blendshape 预垂坠 | pending | - | 4(通过决策门) | - |

### Phase Details

**Phase 0: 验证与度量地基**
- **Goal**:确认根因 + 让主指标可测,避免盲改与不可证。
- **Scope**:(1) 实机跑 `RIGGING_PROVIDER=python` 渲染一件带贴图服装,确认是否显示为灰白外壳;(2) 埋点 try-on 会话开始 / 试穿→加购转化事件,建漏斗;(3) 抽样建立穿模发生率、"无纹理服装"占比基线。
- **Success signal**:根因结论明确(是/否丢材质);转化漏斗可读数;基线数据入库。

**Phase 1: 感知快赢(MVP)**
- **Goal**:用最低成本解决"贴纸/悬浮/灰白外壳"观感的一大半。
- **Scope**:B1(`python_rigging_provider.py:177` 保 UV/材质 + `skinned_glb_writer.py` 加 TEXCOORD/material)、D1(`AvatarViewer.tsx` 接触阴影+柔和阴影)、D2(无材质服装的兜底织物材质)。
- **Success signal**:绑定服装带真实贴图渲染;试穿画面有落地阴影、无灰白外壳;QA 主观真实感提升。

**Phase 2: 质感增强**
- **Goal**:在有 UV 的基础上"伪造"织物褶皱与质感,零布料模拟。
- **Scope**:C1(`meshy_generator.py:223` `enable_pbr=True`,实测质量/成本)、C2(按 slot/category 应用 tiling 法线/褶皱贴图)、D3(环境预设+色调映射,弱化塑料高光)。
- **Success signal**:服装呈现织物微观起伏与质感;塑料高光消失。

**Phase 3: 几何防穿模**
- **Goal**:消灭真穿模——唯一直接击穿"真实感"的硬伤。
- **Scope**:A1(复用 `weight_transfer.py:40` 的 igl 距离,在绑定后写出前把穿入顶点沿法线推到"身体+布料厚度"外);可选 B3(scale_normalizer 从 bbox 高度比升级为肩/腰锚点对齐)。
- **Success signal**:抽样穿模发生率显著下降;轮廓不再露肉/悬浮。

**Phase 4: 转化验证与决策门**
- **Goal**:用数据判断"垂坠真实感是否拉动转化",决定是否投入高成本布料仿真。
- **Scope**:A/B(新旧渲染)或前后对比,读 Phase 0 埋点;评估主指标与次指标。
- **Success signal**:得到"投入布料仿真 / 到此为止"的数据驱动结论。

**Phase 5: 真垂坠(后置,门控)**
- **Goal**:为合身类之外的宽松服装带来物理级真实垂坠(仅在 Phase 4 验证通过后)。
- **Scope**:A2(激活 Blender 路径 + Cloth modifier + 以身体为 collision 单帧烘焙,先做耗时基准);A3(为现有 ~6 个 pose 预模拟垂坠,写入 morph target —— 需先给 `skinned_glb_writer` + `usePoseAnimation` 补 morph 能力)。
- **Success signal**:宽松服装呈现物理可信垂坠,且烘焙耗时在可接受的异步范围内。

### Parallelism Notes

- **Phase 1 与 Phase 2 可并行**:Phase 1 的前端阴影(D1)与后端材质恢复(B1)分属不同代码区;Phase 2 的 C1(Meshy 一行)可立即试,但 **C2 法线贴图依赖 B1 先给出 UV**,故 C2 排在 B1 之后。
- **Phase 3(防穿模)独立于材质/渲染**,可与 1/2 并行开发,但建议合并到同一验证窗口一起 A/B。
- **Phase 0 是所有阶段的前置**(根因未验证 + 无埋点时,不应大规模改动)。
- **Phase 5 严格门控**在 Phase 4 决策之后,避免过早投入高成本布料仿真。

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 总路线 | 感知优先(材质/阴影/PBR/法线/防穿模)先行 | 直接上离线布料仿真 / 直接上 2D 扩散生成 | 市场证明买家要"感知可信"非物理精确;技术上最大观感损失来自非物理问题(材质丢失/无阴影/穿模),性价比远高 |
| MVP 范围 | Phase 0 + Phase 1(B1+D1+D2) | 一次性做全部真实感增强 | 最小闭环验证"垂坠拉动转化"假设,证伪成本最低 |
| 布料仿真 | 后置 + 决策门控 | 纳入 v1 | 复杂度高、耗时敏感、转化非必需;先用轻量项验证需求 |
| 实时布料仿真 | 明确不做(移动主路径) | Three.js Verlet/WebGPU 实时仿真 | 移动 web 性能不可行、自碰撞瓶颈、恐怖谷 |
| 是否训练新模型 | 否(用户硬约束) | 训练/微调 diffusion 或 draping 网络 | 复用现有 SMPL-X + weight transfer 管线的约束 |
| 主指标 | 试穿后加购/转化 | 退货率(滞后)/ 尺码采纳率 / 主观评分 | 用户明确选择;转化是可较快读数的商业信号(退货作长期滞后指标) |

---

## Research Summary

**Market Context**
- 领导者路线两分:**2D 扩散生成**(Google Shopping / Walmart-Zeekit / Revery / Amazon 服装)与**真 3D**(Wanna/Snap、CLO3D/Marvelous Designer 离线仿真、Amazon 鞋)。前者与"不训练 ML"约束冲突,后者中的**离线布料烘焙**最兼容我们的管线。
- 游戏业标准配方与我们高度契合:**低频垂坠→蒙皮/blendshape,高频褶皱→法线贴图**(DeepWrinkles),可完全不训练模型。
- 核心洞察:**买家要感知可信,不要物理精确**;优先级 = 轮廓/尺码对 → 不穿模 → plausible 褶皱。
- 穿模是 3D 试穿头号顽疾,且与 SMPL(-X) + LBS 蒙皮强绑定——我们正用这套,必须专门防御。
- "够好"的量化参考:VTO 转化 +10-25%、退货 -20-35%(厂商数据偏乐观,需自建同期 A/B,退货全效果 60-90 天才稳)。
- 待核实:PRD 初始假设的"Zalando 用 Reactive Reality"未能证实,建议单独核实后再引用。

**Technical Context**(证据均来自代码库,精确到 file:line)
- 现状:无布料模拟 / 无 PBR / 无法线贴图 / 无阴影;绑定为纯 LBS 刚性跟骨。
- **最高性价比修复**:B1 恢复绑定服装的 UV/材质(修复"灰白外壳")、D1 接触阴影(去悬浮感)、A1 igl 几何 push-out(去穿模)、C1/C2 PBR+法线贴图(伪造质感)。
- 可复用基建:igl 距离查询、Blender 绑定链路(保留材质、可挂布料仿真)、slot-aware scale_normalizer、pose 系统。
- 缺口:`skinned_glb_writer` 无 morph target / material / TEXCOORD;`usePoseAnimation` 只处理骨骼四元数轨道。
- 诚实标注:"绑定丢材质渲染成灰白"为代码推断,**需实机 `RIGGING_PROVIDER=python` 验证**(默认 provider 是 `mock`)。

---

*Generated: 2026-09-09*
*Status: DRAFT - needs validation(主指标埋点缺失 + 根因需实机验证 + 定性证据待量化)*
