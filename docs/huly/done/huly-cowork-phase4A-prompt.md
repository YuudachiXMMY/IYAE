# Claude Cowork — Huly Phase 4A: Tracker Setup

> 本文档分为两部分：
> - **Part 1: Instructions** — 粘贴到 Claude Cowork Project 的 Instructions 配置字段
> - **Part 2: Prompt** — 在 Claude Cowork 聊天中发送的执行指令
>
> 前提条件：Chrome Connector 已连接到 `app.huly.io` 已登录标签页。
> GitHub 集成（TASK 7）需要同时登录 GitHub。

---

## Part 1: Instructions

> 复制以下内容，粘贴到 Cowork Project 的 **Instructions** 字段。

```markdown
## 角色

你正在通过 Chrome Connector 操作 Huly (app.huly.io) 的 Web 界面，
为 Clossette 项目配置 Tracker 模块（项目管理 / Issue 跟踪）。
用户已登录 Huly Cloud，workspace 已有 Phase 1-3 的 Cards 知识库。

## 核心规则

1. **截屏验证** — 每个 TASK 开始前和完成后各截屏一次，确认 UI 状态
2. **等待加载** — 每次点击/操作后等 UI 完成加载再继续（Huly 有动画和 loading 状态）
3. **不要猜测** — 找不到 UI 元素时截屏并询问用户，绝不盲猜点击位置
4. **严格按序** — 按 TASK 编号 1-9 顺序执行，不跳步
5. **一步一动** — 每次只做一个 UI 操作，确认成功后再做下一步
6. **Status Category 关键** — 创建 Task Type 的 Process States 时，必须设置正确的 Status Category（Backlog / Active / Done / Cancelled），这控制自动状态转换
7. **完整执行** — 不省略任何 Label、State、Component 或 Issue，按清单全部创建

## 参考文件

- `huly-cowork-phase4A.md` — Phase 4A 完整操作指令（9 个 TASK 的详细步骤）
- `huly-knowledge-base-setup.md` — 完整架构参考（Phase 1-3 的 Types/Tags/Relations 定义）

## 完成标准

- [ ] 14 个 workspace-level Labels
- [ ] 1 个 Space Type `Clossette Project`，含 6 个 Task Types（Feature, Bug, Chore, Spike, Design Task, Content Task）
- [ ] 4 个 Projects：Platform (PLT), Web (WEB), Design (DSN), Marketing (MKT)
- [ ] 19 个 Components（Platform 6 + Web 7 + Design 3 + Marketing 3）
- [ ] 10 个 Milestones（Platform 4 + Web 4 + Design 1 + Marketing 1）
- [ ] 5 个 Issue Templates（Platform 2 + Web 3）
- [ ] GitHub 集成已连接，repo 映射到 Platform（如可能也映射到 Web）
- [ ] 4 个验证 Issues（每个 Project 一个）
- [ ] Kanban 视图列正确显示各 Task Type 的 Process States

## 遇到问题时

1. 截屏当前页面
2. 描述你看到了什么、期望看到什么
3. 等待用户指导后再继续
```

---

## Part 2: Prompt

> 复制以下内容，在 Claude Cowork 聊天中发送。

```markdown
请按照 `huly-cowork-phase4A.md` 执行 TASK 1 到 TASK 9，为 Clossette 配置 Tracker 模块。

开始前先执行 PRE-FLIGHT CHECK：
1. 导航到 Cards 模块，确认 8 个 Card Spaces 存在（Engineering, Product, Design, Marketing, Operations, Finance, People & Culture, Meeting Notes）
2. 导航到 Tracker 模块（左侧栏的 checkbox 图标），确认目前没有已创建的 Projects（全新 Tracker）
3. 如果 Tracker 已有 Projects，停下来问我

PRE-FLIGHT 通过后，按顺序执行：

**TASK 1: 创建 14 个 Labels**
在 Tracker → Labels 中依次创建：
frontend (Blue), backend (Green), worker (Purple), infrastructure (Gray), AI (Orange), 3D (Cyan), UX (Pink), performance (Yellow), security (Red), documentation (Light Gray), design-system (Teal), content (Light Blue), campaign (Magenta), blocker (Dark Red)
— 每个 Label 填写 title + description + 选择颜色。

**TASK 2: 创建 Space Type + 6 个 Task Types**
Settings → SPACE TYPES → `+` → 基于 Tracker → 名称 `Clossette Project` → 如果提供 Classic project 模板则选 Yes → Create。
然后在该 Space Type 内配置 6 个 Task Types（参考 `huly-cowork-phase4A.md` TASK 2 的完整状态表）：
1. 将默认 Issue 重命名为 `Feature`（7 个状态）
2. 新建 `Bug`（6 个状态）
3. 新建 `Chore`（3 个状态）
4. 新建 `Spike`（4 个状态）
5. 新建 `Design Task`（5 个状态）
6. 新建 `Content Task`（6 个状态）

**TASK 3: 创建 4 个 Projects**
全部使用 `Clossette Project` 类型：
- Platform (PLT) — server + worker 代码
- Web (WEB) — Next.js 前端
- Design (DSN) — UI/UX 设计
- Marketing (MKT) — 营销 campaigns + 内容

**TASK 4: 为每个 Project 创建 Components**
Platform (6): AI Styling, 3D Pipeline, Marketplace, Cart & Checkout, Auth & Users, Community
Web (7): AI Styling, 3D Viewer, Marketplace, Cart & Checkout, Community, Design System, Auth & Registration
Design (3): UI/UX, Brand, Marketing Assets
Marketing (3): Social Media, Content, Campaigns

**TASK 5: 创建 Milestones**
Platform + Web 各创建 4 个：v1.0-MVP (Completed), v1.1-Checkout (Completed), v1.2-Community (Completed), v1.3-Next (Planned)
Design: Brand v1 (Planned)
Marketing: Launch Campaign (Planned)

**TASK 6: 创建 Issue Templates**
Platform: Bug Report（Priority=High）+ Feature Request（Priority=Medium）
Web: Bug Report + Feature Request + Design Handoff（labels: UX, design-system）
— 模板内容详见 `huly-cowork-phase4A.md` TASK 6

**TASK 7: GitHub 集成**
Profile → Integrations → GitHub → Add → 授权 Huly GitHub App →
映射 Clossette repo 到 Platform 项目（如可能也映射到 Web）→
创建测试 Issue 验证同步 → 验证后关闭

**TASK 8: 创建 4 个验证 Issues**
1. Platform → Feature: `[Feature] Add avatar pose presets API endpoint`
2. Web → Bug: `[Bug] Size selector not updating cart total on mobile`
3. Design → Design Task: `[Design] Community feed card redesign`
4. Marketing → Content Task: `[Content] Summer collection launch reel for TikTok`
— 每个 Issue 的详细配置（Component, Labels, Milestone）见 `huly-cowork-phase4A.md` TASK 8

**TASK 9: 验证 Kanban 视图**
每个 Project 切换到 Kanban 视图，验证列名与 TASK 2 定义的 Process States 一致，截屏留证。

每完成一个 TASK，先验证结果正确，再执行下一个 TASK。
全部完成后，对照 Instructions 中的完成标准逐项确认。
```

---

## 使用方法

1. 打开 Claude Cowork Project `Huly Knowledge Base Setup`（如还没有，参考 `huly-cowork-prompt.md` 创建）
2. 更新 Project Instructions：用 **Part 1** 的内容替换或追加到现有 Instructions
3. 确保 `huly-cowork-phase4A.md` 在 Project 文件夹中
4. 启用 Chrome Connector，连接到已登录的 `app.huly.io` 标签页
5. 在聊天中发送 **Part 2** 的内容
6. Claude 将按 TASK 1-9 顺序执行，每步截屏验证
