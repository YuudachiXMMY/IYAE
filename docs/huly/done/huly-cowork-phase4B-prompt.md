# Claude Cowork — Huly Phase 4B: Processes Setup

> 本文档分为两部分：
> - **Part 1: Instructions** — 粘贴到 Claude Cowork Project 的 Instructions 配置字段
> - **Part 2: Prompt** — 在 Claude Cowork 聊天中发送的执行指令
>
> 前提条件：Chrome Connector 已连接到 `app.huly.io` 已登录标签页。
> Phase 1-3 Cards + Phase 4A Tracker 已完成（Clossette + Design + Marketing 三个项目，8 Task Types on Classic project）。

---

## Part 1: Instructions

> 复制以下内容，粘贴到 Cowork Project 的 **Instructions** 字段（替换或追加到现有 Instructions）。

```markdown
## 角色

你正在通过 Chrome Connector 操作 Huly (app.huly.io) 的 Web 界面，
为 Clossette 项目配置 Processes 模块（工作流自动化）。
用户已登录 Huly Cloud，workspace 已有 Phase 1-3 的 Cards 知识库和 Phase 4A 的 Tracker。

## 核心规则

1. **截屏验证** — 每个 TASK 开始前和完成后各截屏一次，确认 UI 状态
2. **等待加载** — 每次点击/操作后等 UI 完成加载再继续
3. **不要猜测** — 找不到 UI 元素时截屏并询问用户，绝不盲猜点击位置
4. **严格按序** — 按 TASK 编号 1-8 顺序执行，不跳步
5. **一步一动** — 每次只做一个 UI 操作，确认成功后再做下一步
6. **自适应** — Processes 是较新功能，UI 可能与指南描述不完全一致。TASK 1 是探索任务，先了解 UI 再配置
7. **遇到不支持的功能** — 跳过该步骤，记录下来，继续下一步

## 参考文件

- `huly-cowork-phase4B.md` — Phase 4B 完整操作指令（8 个 TASK 的详细步骤）
- `huly-knowledge-base-setup.md` — 完整架构参考（Card Types 定义）

## 完成标准

- [ ] Processes 模块可访问且功能正常
- [ ] 5 个 Processes 已创建：Content Publishing, Document Approval, Contract Lifecycle, Onboarding, Campaign Lifecycle
- [ ] 至少 2 个 Process 在现有 Cards 上成功执行并验证
- [ ] Process 状态 Saved Views 已创建（如果支持筛选）
- [ ] 每个 Process 定义和执行测试都有截图

## 遇到问题时

1. 截屏当前页面
2. 描述你看到了什么、期望看到什么
3. 等待用户指导后再继续
```

---

## Part 2: Prompt

> 复制以下内容，在 Claude Cowork 聊天中发送。

```markdown
请按照 `huly-cowork-phase4B.md` 执行 TASK 1 到 TASK 8，为 Clossette 配置 Processes 模块。

开始前先执行 PRE-FLIGHT CHECK：
1. 导航到 Cards 模块，确认 8 个 Card Spaces 存在
2. 导航到 Tracker 模块，确认 3 个活跃 Projects 存在 (Clossette/CLOSS, Design/DSN, Marketing/MARKE)
3. 找到 Processes 模块（左侧栏独立模块），点击进入
4. 如果找不到 Processes 模块，检查 Settings 中的模块可见性设置
5. 截屏 Processes 模块的初始 UI

PRE-FLIGHT 通过后，按顺序执行：

**TASK 1: 探索 Processes 模块 UI（不要创建任何内容）**
浏览 Processes 模块界面，截屏并报告：
- 创建新 Process 的方式
- 是否有预置的示例 Process
- Card Type 关联机制
- 状态/转换编辑器的外观
- 自动化/触发器设置
报告完毕后再继续。

**TASK 2: 创建 "Content Publishing" Process**
关联 Card Type: Content Piece
7 个状态: Ideation → Drafting → Review → Approved → Scheduled → Published / Cancelled
详见 `huly-cowork-phase4B.md` TASK 2

**TASK 3: 创建 "Document Approval" Process**
关联 Card Type: Base Document（如不支持父类关联则用 PRD）
5 个状态: Draft → In Review → Changes Requested → Approved → Archived
详见 `huly-cowork-phase4B.md` TASK 3

**TASK 4: 创建 "Contract Lifecycle" Process**
关联 Card Type: Contract
8 个状态: Drafted → Under Review → Negotiation → Signed → Active → Expiring → Expired / Terminated
详见 `huly-cowork-phase4B.md` TASK 4

**TASK 5: 创建 "Onboarding" Process**
关联 Card Type: Onboarding Checklist
5 个状态: Not Started → Week 1 → Week 2-4 → Probation → Completed
详见 `huly-cowork-phase4B.md` TASK 5

**TASK 6: 创建 "Campaign Lifecycle" Process**
关联 Card Type: Campaign Plan
7 个状态: Planning → Content Creation → Ready → Active → Paused → Completed / Cancelled
详见 `huly-cowork-phase4B.md` TASK 6

**TASK 7: 验证 Process 执行**
在 4 个现有 Cards 上启动对应 Process，验证状态流转正常：
1. Marketing → Content Piece → Content Publishing
2. Product → PRD → Document Approval
3. Finance → Contract → Contract Lifecycle
4. Marketing → Campaign Plan → Campaign Lifecycle
详见 `huly-cowork-phase4B.md` TASK 7

**TASK 8: 创建 Process 状态 Saved Views（如支持）**
4 个视图: Content: Awaiting Review, Campaigns: Active, PRDs: In Review, Contracts: Expiring
详见 `huly-cowork-phase4B.md` TASK 8
如果 Cards 模块不支持按 Process 状态筛选，跳过此 TASK。

每完成一个 TASK，先验证结果正确，再执行下一个 TASK。
全部完成后，对照 Instructions 中的完成标准逐项确认。
```

---

## 使用方法

1. 打开 Claude Cowork Project `Huly Knowledge Base Setup`
2. 更新 Project Instructions：用 **Part 1** 的内容替换或追加到现有 Instructions
3. 确保 `huly-cowork-phase4B.md` 在 Project 文件夹中
4. 启用 Chrome Connector，连接到已登录的 `app.huly.io` 标签页
5. 在聊天中发送 **Part 2** 的内容
6. Claude 将按 TASK 1-8 顺序执行，TASK 1 先探索 UI 再配置
