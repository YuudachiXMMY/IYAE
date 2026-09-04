# Claude Cowork Project 配置指南 — Huly 知识库搭建

> 本文档指导如何在 Claude Cowork 中创建 Project 并正确配置 Instructions、Files、Links，
> 让 Claude 通过 Chrome Connector 自动操作 Huly 浏览器界面完成知识库搭建。

---

## 目录

1. [Cowork Project 核心概念](#1-核心概念)
2. [创建 Project 步骤](#2-创建-project)
3. [配置 Instructions](#3-配置-instructions)
4. [添加文件（Context Files）](#4-添加文件)
5. [添加链接（URL Context）](#5-添加链接)
6. [配置 Connectors](#6-配置-connectors)
7. [Huly 搭建的完整 Instructions 模板](#7-huly-instructions-模板)
8. [常见问题](#8-常见问题)

---

## 1. 核心概念

Claude Cowork Project 有 4 个配置维度：

| 维度 | 作用 | 持久性 |
|------|------|--------|
| **Instructions** | 告诉 Claude "你是谁、怎么做、什么规则" | 每次任务自动加载 |
| **Context (Files)** | 本地文件夹中的参考资料 | 文件变更自动同步 |
| **Context (URLs)** | 外部网页链接供 Claude 参考 | 每次任务按需抓取 |
| **Memory** | Claude 自动记住项目内的工作记忆 | 跨任务持久化（项目内） |

> **关键区别**: Instructions 是"规则"（必须遵守），Files 是"参考资料"（按需查阅），URLs 是"外部知识"（按需抓取）。

---

## 2. 创建 Project

### 步骤

1. 打开 Claude Desktop → 切换到 **Cowork** 标签（顶部或侧栏）
2. 左侧 **Projects** 面板 → 点击 **+** 按钮
3. 选择 **Start from scratch**（从零开始）
4. 输入项目名称: `Huly Knowledge Base Setup`
5. 选择本地文件夹: 指向 `~/Development/Clossette/docs/` 或专门创建一个 `~/Cowork/huly-setup/` 文件夹
6. 填写 Instructions（见第 3 节）
7. 添加 Files 和 URLs（见第 4-5 节）
8. 点击 **Create**

---

## 3. 配置 Instructions

### Instructions 该写什么

Instructions 是 Project 最重要的配置。它定义了 Claude 在该项目所有任务中的行为准则。

**好的 Instructions 包含这 5 个部分：**

```
1. 角色定义     → 你是谁，做什么
2. 工作规则     → 必须遵守的硬约束
3. 输出风格     → 回答的格式和语气
4. 上下文引用   → 怎么使用提供的 Files 和 URLs
5. 错误处理     → 遇到问题怎么办
```

### Instructions 书写原则

| 原则 | 好的写法 | 差的写法 |
|------|---------|---------|
| **具体** | "每个 TASK 前后各截一次屏" | "注意检查" |
| **约束性** | "不要猜测 UI 元素位置，找不到就截屏问我" | "小心操作" |
| **分层** | 用编号分 TASK，每步一个动作 | 一大段文字没有结构 |
| **引用文件** | "参考 `huly-phase1.md` 中的 TASK 1-6" | "按照之前的文档" |

### 一个通用的 Instructions 框架

```markdown
## 角色
你正在通过 Chrome Connector 操作 [目标应用] 的 Web 界面。
用户已登录，你可以直接操作页面。

## 规则
1. 每个 TASK 开始前截屏确认当前页面状态
2. 每步操作后等待 UI 加载完成（至少 2 秒）
3. 找不到 UI 元素时截屏并询问用户，不要猜测点击位置
4. 按照 `[文件名].md` 中的步骤顺序执行
5. 创建下拉菜单(enum)前，先检查是否已存在同名 enum

## 参考文件
- `[文件名].md` — 详细操作步骤
- [URL] — 目标应用的官方文档

## 完成标准
列出所有需要验证的条目
```

---

## 4. 添加文件

### 方式 1: 通过 Project 文件夹（推荐）

创建 Project 时选择的文件夹中的所有文件，Claude 都能自动读取。

```
~/Cowork/huly-setup/                   ← Project 文件夹
├── huly-phase1.md                     ← 详细操作步骤（TASK 1-6）
├── huly-knowledge-base-setup.md       ← 完整架构参考
├── about-project.md                   ← 项目背景信息（可选）
└── notes/                             ← 子文件夹也能读取
    └── meeting-notes.md
```

**操作步骤：**
1. 把文件放入 Project 文件夹
2. Claude 自动识别新增文件
3. 在任务中引用: "参考 `huly-phase1.md` 的 TASK 3"

### 方式 2: 创建 Project 时手动添加

1. 创建 Project 界面 → "Attach additional files" 区域
2. 点击添加或拖拽文件进去
3. 支持的格式: `.md`, `.txt`, `.pdf`, `.csv`, `.json`, `.docx`, `.xlsx` 等

### 文件命名建议

| 文件 | 内容 | 文件名建议 |
|------|------|-----------|
| Phase 1 操作步骤 | 基础框架的浏览器操作指令 (TASK 1-6) | `huly-cowork-phase1.md` |
| Phase 2A 操作步骤 | Design + Marketing 的浏览器操作指令 (TASK 1-10) | `huly-cowork-phase2A.md` |
| Phase 2B 操作步骤 | Finance + People & Culture + Operations 补充 (TASK 1-13) | `huly-cowork-phase2B.md` |
| Phase 4A 操作步骤 | Tracker 模块配置 (TASK 1-9) | `huly-cowork-phase4A.md` |
| Phase 4B 操作步骤 | Processes 工作流配置 (TASK 1-8) | `huly-cowork-phase4B.md` |
| Phase 4C 操作步骤 | Documents 模块 Wiki 结构 (TASK 1-8) | `huly-cowork-phase4C.md` |
| Phase 4D 操作步骤 | Planner + 跨模块集成 (TASK 1-8) | `huly-cowork-phase4D.md` |
| Phase 4E 操作步骤 | Tracker 模板 + Operations 项目 (TASK 1-7) | `huly-cowork-phase4E.md` |
| 架构参考 | Types/Tags/Relations 完整定义 | `huly-knowledge-base-setup.md` |
| 项目背景 | Clossette 是什么，团队结构 | `about-clossette.md` |

### 对于当前 Huly 搭建任务

把以下文件复制到 Project 文件夹：
- `docs/huly/huly-cowork-phase1.md` → Phase 1 操作步骤（基础框架）
- `docs/huly/huly-cowork-phase2A.md` → Phase 2A 操作步骤（Design + Marketing）
- `docs/huly/huly-cowork-phase2B.md` → Phase 2B 操作步骤（Finance + People & Culture）
- `docs/huly/huly-knowledge-base-setup.md` → 完整架构参考（所有 Phases）

---

## 5. 添加链接

### 方式: Project Context 中粘贴 URL

1. 打开 Project 设置
2. 找到 **Context** 区域
3. 选择 "Paste in a URL"
4. 粘贴 URL → Claude 会在执行任务时按需抓取该页面内容

### 推荐添加的 URLs

对于 Huly 知识库搭建，建议添加这些链接：

| URL | 用途 |
|-----|------|
| `https://docs.huly.io/cards/cards-overview/` | Cards 系统概览（遇到问题时参考） |
| `https://docs.huly.io/cards/types/creating-types/` | 创建 Types 的详细指南 |
| `https://docs.huly.io/cards/tags/creating-tags/` | 创建 Tags 的详细指南 |
| `https://docs.huly.io/cards/relations/defining-relations/` | 定义 Relations 的详细指南 |
| `https://docs.huly.io/cards/creating-cards/` | 创建 Cards 的详细指南 |

### URL vs File 的选择

| 场景 | 用 File | 用 URL |
|------|---------|--------|
| 你自己写的操作步骤 | ✓ | |
| 外部官方文档 | | ✓ |
| 频繁变动的参考资料 | | ✓ (每次抓取最新) |
| 离线也需要访问 | ✓ (下载保存) | |
| 内容超过 1 页 | ✓ (完整保存) | ✓ (Claude 会提取关键信息) |

---

## 6. 配置 Connectors

### Chrome Connector（Huly 操作必需）

这是让 Claude 操控浏览器的关键：

1. Claude Desktop → **Customize** → **Connectors**
2. 找到 **Chrome** connector → 启用
3. 在 Chrome 浏览器中安装 Claude 扩展（如果还没有）
4. 打开 `app.huly.io` 并登录
5. 确保 Chrome connector 状态显示为 "Connected"

### 其他可选 Connectors

| Connector | 用途 |
|-----------|------|
| Google Drive | 如果参考文档在 Drive 上 |
| Google Calendar | 同步会议信息到 Meeting Notes |
| Slack | 关联团队讨论 |

---

## 7. Huly Instructions 模板

> 直接复制以下内容，粘贴到 Project 的 Instructions 字段。

```markdown
## 角色

你正在通过 Chrome Connector 操作 Huly (app.huly.io) 的 Web 界面，
为 Clossette 项目搭建知识库。用户已登录 Huly Cloud。

## 核心规则

1. **截屏验证** — 每个 TASK 开始前和完成后各截屏一次
2. **等待加载** — 每次点击/操作后等 UI 完成加载再继续
3. **不要猜测** — 找不到 UI 元素时截屏并询问用户
4. **复用 Enum** — 创建 Select/Multi-select 属性时，先检查同名 enum 是否已存在
5. **严格按序** — 按 TASK 编号顺序执行，不跳步
6. **一步一动** — 每次只做一个 UI 操作，确认成功后再下一步

## 参考文件

- `huly-cowork-phase1.md` — Phase 1 操作指令（6 个 TASK）
- `huly-cowork-phase2A.md` — Phase 2A 操作指令（10 个 TASK）
- `huly-cowork-phase2B.md` — Phase 2B 操作指令（13 个 TASK）
- `huly-cowork-phase3.md` — Phase 3 操作指令（11 个 TASK）
- `huly-cowork-phase4A.md` — Phase 4A 操作指令（9 个 TASK）
- `huly-cowork-phase4B.md` — Phase 4B 操作指令（8 个 TASK）
- `huly-cowork-phase4C.md` — Phase 4C 操作指令（8 个 TASK）
- `huly-cowork-phase4D.md` — Phase 4D 操作指令（8 个 TASK）
- `huly-cowork-phase4E.md` — Phase 4E 操作指令（7 个 TASK）
- `huly-cowork-phase5.md` — Phase 5 操作指令（8 个 TASK）
- `huly-knowledge-base-setup.md` — 完整架构参考（Types/Tags/Relations 定义）

## 执行指令

根据当前阶段选择对应文件：

**Phase 1（基础框架）:**
按照 `huly-cowork-phase1.md` 中的 TASK 1 到 TASK 6 顺序执行。

**Phase 2A（Design + Marketing）:**
先执行 PRE-FLIGHT CHECK 验证 Phase 1 完成，
然后按照 `huly-cowork-phase2A.md` 中的 TASK 1 到 TASK 10 顺序执行。
每完成一个TASK，先验证，再执行下一个TASK。

**Phase 2B（Finance + People & Culture + Operations 补充）:**
先执行 PRE-FLIGHT CHECK 验证 Phase 1 + 2A 完成，
然后按照 `huly-cowork-phase2B.md` 中的 TASK 1 到 TASK 13 顺序执行。
每完成一个TASK，先验证，再执行下一个TASK。

**Phase 3（优化 + 文档迁移 + 集成）:**
先执行 PRE-FLIGHT CHECK 验证 Phase 1 + 2A + 2B 完成，
然后按照 `huly-cowork-phase3.md` 中的 TASK 1 到 TASK 11 顺序执行。
每完成一个TASK，先验证，再执行下一个TASK。

**Phase 4A（Tracker 模块配置）:**
先执行 PRE-FLIGHT CHECK 验证 Phase 1-3 Cards 完成且 Tracker 为空，
然后按照 `huly-cowork-phase4A.md` 中的 TASK 1 到 TASK 9 顺序执行。
每完成一个TASK，先验证，再执行下一个TASK。

**Phase 4B（Processes 工作流配置）:**
先执行 PRE-FLIGHT CHECK 验证 Phase 1-3 Cards + Phase 4A Tracker 完成（Clossette + Design + Marketing 三个项目），
然后按照 `huly-cowork-phase4B.md` 中的 TASK 1 到 TASK 8 顺序执行。
TASK 1 是探索任务（截屏报告 UI），不创建任何内容。
每完成一个TASK，先验证，再执行下一个TASK。

**Phase 4C（Documents 模块 Wiki 结构）:**
先执行 PRE-FLIGHT CHECK 验证 Phase 1-3 Cards + Phase 4A Tracker + Phase 4B Processes 完成，
然后按照 `huly-cowork-phase4C.md` 中的 TASK 1 到 TASK 8 顺序执行。
TASK 1 是探索任务（截屏报告 UI），不创建任何内容。
每完成一个TASK，先验证，再执行下一个TASK。

**Phase 4D（Planner + 跨模块集成）:**
先执行 PRE-FLIGHT CHECK 验证 Phase 1-3 Cards + Phase 4A Tracker + Phase 4B Processes + Phase 4C Documents 完成，
然后按照 `huly-cowork-phase4D.md` 中的 TASK 1 到 TASK 8 顺序执行。
TASK 1 是探索任务（截屏报告 UI），不创建任何内容。
TASK 8 是知识库完整性审计（总览报告），生成全量统计。
每完成一个TASK，先验证，再执行下一个TASK。

**Phase 4E（Tracker 模板 + Operations 项目）:**
先确认 Phase 4A Tracker 完成（3 个项目 + 3 个现有模板），
然后按照 `huly-cowork-phase4E.md` 中的 TASK 1 到 TASK 7 顺序执行。
TASK 1 创建 Operations 项目，TASK 2-5 为各项目添加模板，TASK 6-7 验证。
每完成一个TASK，先验证，再执行下一个TASK。

**Phase 5（Designer Partnership Management）:**
先执行 PRE-FLIGHT CHECK 验证 Phase 1-4E 全部完成（8 Spaces, 4 Tracker Projects, 5 Processes, 14 Templates），
然后按照 `huly-cowork-phase5.md` 中的 TASK 1 到 TASK 8 顺序执行。
TASK 1 扩展 Enum，TASK 2-4 创建 SOP/Vendor/Onboarding Cards，TASK 5-6 添加 Tracker 模板，TASK 7 创建 Saved Views，TASK 8 验证端到端流程。
每完成一个TASK，先验证，再执行下一个TASK。

## 完成标准

**Phase 1 完成标准：**
- [ ] 2 个顶层 Types: Base Document, Meeting Note
- [ ] 4 个派生 Types: Feature Spec, ADR, PRD, SOP
- [ ] 4 个 Tags: Priority, Confidential, Review Required, Clossette Module
- [ ] 2 个 Relations: PRD→Feature Spec (1:N), Feature Spec→ADR (N:N)
- [ ] 4 个 Spaces: Engineering, Product, Operations, Meeting Notes
- [ ] 5 个验证 Cards（每个 Type 一个示例）

**Phase 2A 完成标准：**
- [ ] 6 个新 Types: Design Asset, Design System Entry, Brand Guideline, Campaign Plan, Content Piece, Channel Strategy
- [ ] 14 个新 Enums
- [ ] 3 个新 Relations: Design Asset↔Feature Spec, Campaign↔Content Piece, Campaign↔PRD
- [ ] 2 个新 Spaces: Design, Marketing
- [ ] 6 个验证 Cards + 跨 Space Relation 链接正常
- [ ] 4 个 Saved Views: Active Campaigns, Content Calendar, Design Review Queue, Stable Components

**Phase 2B 完成标准：**
- [ ] 8 个新 Types: Vendor, Contract, Budget Item, Onboarding Checklist, Training Material, Role Description, Policy, Company Handbook Entry
- [ ] 15 个新 Enums + 复用 Phase 1 的 Department enum
- [ ] 1 个新 Relation: Vendor↔Contract (1:N)
- [ ] 2 个新 Spaces: Finance (严格私有), People & Culture
- [ ] Operations Space 更新: 新增 Policy + Company Handbook Entry
- [ ] 8 个验证 Cards + Confidential/Review Required Tags 正常
- [ ] 5 个 Saved Views: Active Vendors, Expiring Contracts, Open Positions, Beginner Training, Active Policies

**Phase 3 完成标准：**
- [ ] 2 个新 Types: Tech Design Doc, API Doc (添加到 Engineering Space)
- [ ] 3 个新 Enums + 1 个新 Relation: Feature Spec↔API Doc (1:N)
- [ ] 6 个全局 Saved Views
- [ ] Clossette Module Tag 已部署到现有产品 Cards
- [ ] 12 个文档迁移 Cards (PRD.md + 5 CODEMAPS + Meshy API + Pose Guide + 4 CLAUDE.md)
- [ ] GitHub 集成已连接
- [ ] 维护计划文档已创建

**Phase 4A 完成标准：**
- [ ] 14 个 workspace-level Labels
- [ ] 1 个 Space Type `Clossette Project`，含 6 个 Task Types（Feature, Bug, Chore, Spike, Design Task, Content Task）
- [ ] 4 个 Projects：Platform (PLT), Web (WEB), Design (DSN), Marketing (MKT)
- [ ] 19 个 Components（Platform 6 + Web 7 + Design 3 + Marketing 3）
- [ ] 10 个 Milestones（Platform 4 + Web 4 + Design 1 + Marketing 1）
- [ ] 5 个 Issue Templates（Platform 2 + Web 3）
- [ ] GitHub 集成已连接，repo 映射到 Platform
- [ ] 4 个验证 Issues（每个 Project 一个）
- [ ] Kanban 视图列正确显示各 Task Type 的 Process States

**Phase 4B 完成标准：**
- [ ] Processes 模块可访问且功能正常
- [ ] 5 个 Processes：Content Publishing, Document Approval, Contract Lifecycle, Onboarding, Campaign Lifecycle
- [ ] 至少 2 个 Process 在现有 Cards 上成功执行并验证
- [ ] Process 状态 Saved Views 已创建（如果支持筛选）

**Phase 4C 完成标准：**
- [ ] 4 个 Document Teamspaces：Company Wiki, Engineering Wiki, Product & Design Wiki, Meeting Agendas & Reports
- [ ] Engineering Wiki 含 3 个 section（Development Setup, Runbooks, Architecture Notes）+ 子文档
- [ ] Product & Design Wiki 含 3 个 section（Brainstorms, User Personas, Design Principles）
- [ ] Company Wiki 含 4 个文档（About Clossette, Onboarding Guide, Tool Stack, Team Values）
- [ ] Meeting Agendas & Reports 含 4 个模板 + Weekly Reports 容器
- [ ] Documents → Cards 跨链接测试完成（结果已记录）

**Phase 4D 完成标准：**
- [ ] Planner 模块可访问，Day/Week 视图已探索
- [ ] 3 个个人 To-Do 已创建，Tracker Issues 在 Planner 中可见（或限制已记录）
- [ ] 时间追踪功能已探索（可用/不可用已记录）
- [ ] 6 个跨模块链接方向已测试（Issue↔Card, Document↔Card, Issue↔Document）
- [ ] Process ↔ Planner 交互已测试
- [ ] 所有 prior-phase Saved Views 仍可访问
- [ ] 知识库完整性审计完成（模块清单 + 跨模块导航测试 + 总结报告）

**Phase 4E 完成标准：**
- [ ] Operations 项目 (OPS) 已创建，含 4 个 Components + 2 个 Milestones
- [ ] Clossette 新增 3 个模板：[Spike], [Chore], [Hotfix]（总计 6 个）
- [ ] Design 新增 2 个模板：[Review], [Asset]
- [ ] Marketing 新增 2 个模板：[Content], [Campaign]
- [ ] Operations 新增 4 个模板：[Incident], [SOP], [Procurement], [Policy]
- [ ] 全部 14 个模板可访问且可用
- [ ] 2 个验证 Issues 已在 Operations 项目创建

**Phase 5 完成标准：**
- [ ] 2 个 Enum 选项新增：Vendor Category (`Designer Partner`), Role (`Designer Partner`)
- [ ] SOP Card 已创建：`SOP: Designer Partnership Evaluation`（Operations space）
- [ ] Vendor Card 已创建：`[Example] Luna Studio`（Category = Designer Partner）
- [ ] Contract Card 已创建：`Luna Studio - Designer Partnership Agreement`（Partnership 类型）
- [ ] Vendor → Contract Relation 已验证（governed by / belongs to）
- [ ] Contract Lifecycle Process 已启动且状态可见
- [ ] Onboarding Checklist Card 已创建：`Designer Onboarding: [Example] Luna Studio`
- [ ] Onboarding Process 已启动且状态可见
- [ ] Operations 新增 1 个模板：[Onboarding] Designer（总计 5 个）
- [ ] Marketing 新增 1 个模板：[Outreach] Designer（总计 3 个）
- [ ] 2 个 Saved Views 已创建：`Designer Partners`（Finance）、`Partnership & Process SOPs`（Operations）
- [ ] 端到端流程已验证：Campaign → Outreach → Evaluation → Contract → Onboarding → Go-Live
- [ ] 全部模板总计：Clossette 6 + Design 2 + Marketing 4 + Operations 6 = 18 个

## 遇到问题时

1. 截屏当前页面
2. 描述你看到了什么、期望看到什么
3. 等待用户指导后再继续
```

---

## 8. 常见问题

### Q: Instructions 和 Files 里的步骤有什么区别？

**Instructions** 放"规则和行为准则"（简短、明确、每次自动加载）。
**Files** 放"详细操作步骤"（长文档、可以按需查阅特定部分）。

类比：Instructions 是给员工的"工作手册摘要"，Files 是"完整的操作手册"。

### Q: 可以在 Instructions 里直接写所有操作步骤吗？

技术上可以，但不推荐。Instructions 过长会影响效率。最佳实践是：
- Instructions: 50-200 字的规则和引导（告诉 Claude "怎么做"）
- Files: 详细步骤（告诉 Claude "做什么"）

### Q: URL 链接 Claude 每次都会抓取吗？

不是。Claude 会按需抓取——当任务涉及相关内容时才会读取。URL 主要作为"备查参考"。

### Q: Project 的 Memory 是什么？

Memory 是 Claude 在项目内自动积累的工作记忆。例如：
- "上次创建 Types 时遇到了 enum 重复问题"
- "用户偏好先创建所有 enum 再创建 Types"

Memory 只在同一个 Project 内有效，不会跨 Project。

### Q: 我需要分多个 Project 吗？

对于 Huly 搭建，推荐用**一个 Project + 分阶段的指令文件**：
- **Project**: `Huly Knowledge Base Setup`
- **Phase 1 文件**: `huly-cowork-phase1.md`（基础框架，已完成）
- **Phase 2A 文件**: `huly-cowork-phase2A.md`（Design + Marketing）
- **Phase 2B 文件**: `huly-cowork-phase2B.md`（Finance + People & Culture）
- **Phase 3 文件**: `huly-cowork-phase3.md`（Saved Views + 文档迁移 + 集成）
- **Phase 4A 文件**: `huly-cowork-phase4A.md`（Tracker 模块配置）
- **Phase 4B 文件**: `huly-cowork-phase4B.md`（Processes 工作流配置）

每次执行新 Phase 时，在任务中指定："按照 `huly-cowork-phase2A.md` 执行"。
Project 的 Memory 会记住之前 Phase 的操作经验，帮助后续 Phase 避免重复错误。

---

## 快速配置清单

为了搭建 Huly 知识库，你需要在 Cowork Project 中完成：

- [ ] 创建 Project: `Huly Knowledge Base Setup`
- [ ] 设置 Project 文件夹并放入 5 个 md 文件（phase1, phase2A, phase2B, phase4A, setup）
- [ ] 粘贴 Instructions（第 7 节模板）
- [ ] 添加 5 个 Huly 文档 URLs（第 5 节列表）
- [ ] 启用 Chrome Connector 并连接到 `app.huly.io` 标签页
- [ ] Phase 1: "按照 huly-cowork-phase1.md 执行 TASK 1-6"
- [ ] Phase 2A: "按照 huly-cowork-phase2A.md 执行 TASK 1-10"
- [ ] Phase 2B: "按照 huly-cowork-phase2B.md 执行 TASK 1-13"
- [ ] Phase 3: "按照 huly-cowork-phase3.md 执行 TASK 1-11"
- [ ] Phase 4A: "按照 huly-cowork-phase4A.md 执行 TASK 1-9"
- [ ] Phase 4B: "按照 huly-cowork-phase4B.md 执行 TASK 1-8"
- [ ] Phase 4C: "按照 huly-cowork-phase4C.md 执行 TASK 1-8"
- [ ] Phase 4D: "按照 huly-cowork-phase4D.md 执行 TASK 1-8"
- [ ] Phase 4E: "按照 huly-cowork-phase4E.md 执行 TASK 1-7"
