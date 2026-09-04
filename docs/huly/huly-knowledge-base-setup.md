# Clossette — Huly 知识库架构设计与搭建指南

> 基于 Huly Cloud，为 5-15 人跨职能团队设计的全业务知识库。
> 覆盖：开发、产品、设计、市场、运营、财务、HR。

---

## 目录

1. [架构总览](#1-架构总览)
2. [Spaces 规划](#2-spaces-规划)
3. [Card Types 设计（按领域）](#3-card-types-设计)
4. [Tags 系统](#4-tags-系统)
5. [Relations 关系图谱](#5-relations-关系图谱)
6. [搭建顺序（Step-by-Step）](#6-搭建顺序)
7. [命名规范](#7-命名规范)
8. [维护与治理](#8-维护与治理)

---

## 1. 架构总览

```
Huly Workspace: Clossette
│
├── Spaces (按业务领域划分)
│   ├── Engineering        → 技术文档、ADR、Feature Specs
│   ├── Product            → PRD、用户研究、路线图
│   ├── Design             → 设计资产、设计系统、品牌规范
│   ├── Marketing          → 营销活动、内容日历、渠道策略
│   ├── Operations         → SOP、公司政策、内部手册
│   ├── Finance            → 供应商、合同、预算
│   ├── People & Culture   → 入职清单、培训材料、团队目录
│   └── Meeting Notes      → 跨部门会议记录
│
├── Card Types (按层级派生)
│   ├── Base Types         → 基础模板（全局共享属性）
│   └── Derived Types      → 按领域细化的子类型
│
├── Tags (跨 Type 复用的属性集)
│   ├── Priority           → 优先级标记
│   ├── Confidential       → 保密等级
│   └── Department         → 部门归属
│
└── Relations (Types 之间的结构化连接)
    ├── PRD → Feature Spec (1:N)
    ├── Campaign → Content Piece (1:N)
    ├── Vendor → Contract (1:N)
    └── ... (详见第 5 节)
```

### 设计原则

| 原则 | 说明 |
|------|------|
| **Cards 优先** | 所有需要分类、筛选、关联的内容用 Cards；自由笔记用 Documents |
| **Type 继承** | 利用派生 Type 减少重复定义（如 Base Document → PRD / ADR / SOP） |
| **Tag 复用** | 跨领域通用属性（优先级、保密等级）用 Tags，不在每个 Type 重复 |
| **Relation 显式化** | 用 Relations 代替文本中的 mention 链接，建立可筛选的结构化关系 |
| **渐进式搭建** | 先搭核心 Types（Phase 1），验证后扩展其余领域（Phase 2-3） |

---

## 2. Spaces 规划

每个 Space 对应一个业务领域，控制成员访问权限。

| Space 名称 | 包含的 Types | 可见性 | 核心成员 |
|------------|-------------|--------|----------|
| **Engineering** | Feature Spec, ADR, Tech Design, Bug Report, API Doc | Private | 工程师、Tech Lead |
| **Product** | PRD, User Research, Roadmap Item, Release Note | Private | PM、设计师、工程 Lead |
| **Design** | Design Asset (File), Design System Entry, Brand Guideline | Private | 设计师、PM |
| **Marketing** | Campaign Plan, Content Piece, Channel Strategy | Private | 市场团队、创始人 |
| **Operations** | SOP, Policy, Company Handbook Entry | 全员可见 | 运营、创始人 |
| **Finance** | Vendor, Contract, Budget Item, Invoice | Private | 财务、创始人 |
| **People & Culture** | Onboarding Checklist, Training Material, Role Description | Private | HR、管理层 |
| **Meeting Notes** | Meeting Note | 全员可见 | 全员 |

> **Tips**: Huly 的 Space 权限分 Owner / Member 两级。Private Space 只有被添加的成员才能看到。

---

## 3. Card Types 设计

### 3.0 Base Document（根 Type）

> 所有文档类 Card 的基础。不直接创建实例，作为派生起点。

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Status | Select | Draft / In Review / Approved / Active / Archived |
| Owner | Text | 负责人名字 |
| Last Reviewed | Date | 最近审核日期 |

---

### 3.1 Engineering（工程）

#### Type: Feature Spec
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Epic | Text | 所属 Epic 名称 |
| Module | Select | server / web / worker / infra |
| Sprint | Text | Sprint 标识 (如 Sprint-24) |
| Complexity | Select | S / M / L / XL |
| Target Release | Date | 目标发布日期 |

**Tags**: Priority, Department
**Relations**:
- Feature Spec *implements* → PRD (N:1)
- Feature Spec *decided by* → ADR (N:N)
- Feature Spec *produces* → API Doc (1:N)

---

#### Type: Architecture Decision Record (ADR)
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Decision Status | Select | Proposed / Accepted / Deprecated / Superseded |
| Decision Date | Date | 决策日期 |
| Deciders | Text | 参与决策的人 |
| Context | Text | 决策背景摘要 |
| Consequences | Text | 预期影响 |

**Relations**:
- ADR *affects* → Feature Spec (N:N)

---

#### Type: Tech Design Doc
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Module | Select | server / web / worker / infra |
| Design Type | Select | System Design / API Design / Data Model / Algorithm |
| Review Status | Select | Draft / Peer Review / Approved |

---

#### Type: Bug Report

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Severity | Select | Critical / High / Medium / Low |
| Status | Select | Open / Investigating / Fix In Progress / Resolved / Won't Fix |
| Environment | Select | Production / Staging / Development |
| Reporter | Text | 报告人 |
| Steps to Reproduce | Text | 复现步骤 |
| Affected Module | Select | server / web / worker |

> **注意**: 如果团队已用 Huly Tracker 管理 Issues，可以不创建此 Type，避免重复。

---

#### Type: API Doc
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Endpoint | Text | API 路径 (如 /api/products) |
| HTTP Method | Select | GET / POST / PUT / DELETE / PATCH |
| Auth Required | Checkbox | 是否需要认证 |
| Module | Select | server |
| API Version | Text | v1 / v2 |

---

### 3.2 Product（产品）

#### Type: PRD (Product Requirements Document)
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Product Area | Select | AI Styling / 3D Try-On / Marketplace / Community / Cart & Checkout |
| Target Persona | Multi-select | Gen Z Shopper / Young Professional / Indie Designer |
| Business Impact | Select | Revenue / Retention / Acquisition / Engagement |
| Target Release | Date | 目标发布日期 |
| Success Metrics | Text | 成功衡量指标 |

**Relations**:
- PRD *drives* → Feature Spec (1:N)
- PRD *informed by* → User Research (N:N)

---

#### Type: User Research
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Research Type | Select | Interview / Survey / Usability Test / A-B Test / Analytics |
| Participants | Number | 参与人数 |
| Research Date | Date | 执行日期 |
| Key Findings | Text | 核心发现摘要 |

**Relations**:
- User Research *informs* → PRD (N:N)

---

#### Type: Release Note
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Version | Text | 版本号 (如 v1.2.0) |
| Release Date | Date | 发布日期 |
| Release Type | Select | Major / Minor / Patch / Hotfix |
| Highlights | Text | 亮点功能摘要 |

---

### 3.3 Design（设计）

#### Type: Design Asset
> 派生自: **File Type**（Huly 内置，支持文件上传区域）

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Asset Type | Select | UI Mockup / Icon / Illustration / Photo / 3D Model / Video |
| Design Tool | Select | Figma / Blender / Photoshop / Illustrator / Other |
| Version | Text | 版本号 |
| Status | Select | WIP / Ready for Review / Approved / Delivered |
| Platform | Multi-select | Web / iOS / Android |

---

#### Type: Design System Entry

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Component Name | Text | 组件名 (如 Button, SizeSelector) |
| Category | Select | Primitive / Composite / Layout / Motion / Token |
| Platform | Multi-select | Web / iOS / Android |
| Status | Select | Draft / Stable / Deprecated |
| Figma Link | URL | Figma 文件链接 |
| Code Path | Text | 代码路径 (如 web/components/ui/button.tsx) |

---

#### Type: Brand Guideline
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Guideline Area | Select | Logo / Color / Typography / Imagery / Voice & Tone / Motion |
| Version | Text | 版本号 |

---

### 3.4 Marketing（市场）

#### Type: Campaign Plan

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Campaign Name | Text | 活动名称 |
| Status | Select | Planning / Active / Paused / Completed / Cancelled |
| Channel | Multi-select | Instagram / TikTok / Xiaohongshu / Email / PR / Paid Ads |
| Budget | Number | 预算 (CAD) |
| Start Date | Date | 开始日期 |
| End Date | Date | 结束日期 |
| Target Audience | Multi-select | Gen Z / Young Professional / Designer |
| KPI | Text | 核心 KPI 描述 |

**Relations**:
- Campaign *contains* → Content Piece (1:N)
- Campaign *promotes* → PRD (N:N)

---

#### Type: Content Piece

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Content Type | Select | Blog Post / Social Post / Email / Video / Press Release / Landing Page |
| Platform | Select | Instagram / TikTok / Xiaohongshu / Website / Email / YouTube |
| Status | Select | Ideation / Drafting / Review / Scheduled / Published |
| Publish Date | Date | 发布日期 |
| Author | Text | 作者 |
| Content Link | URL | 发布链接 |

**Tags**: Priority

---

#### Type: Channel Strategy
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Channel | Select | Instagram / TikTok / Xiaohongshu / Email / SEO / Paid |
| Goal | Text | 渠道目标 |
| Review Cadence | Select | Weekly / Monthly / Quarterly |

---

### 3.5 Operations（运营）

#### Type: SOP (Standard Operating Procedure)
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Department | Select | Engineering / Design / Marketing / Operations / Finance / HR |
| Category | Select | Process / Checklist / Runbook / Playbook |
| Review Cycle | Select | Monthly / Quarterly / Semi-annual / Annual |
| Next Review | Date | 下次审核日期 |
| Compliance Required | Checkbox | 是否涉及合规要求 |

---

#### Type: Policy
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Policy Area | Select | Security / Privacy / HR / Finance / Legal / General |
| Effective Date | Date | 生效日期 |
| Expiry Date | Date | 到期日期（可选） |
| Approver | Text | 审批人 |

---

#### Type: Company Handbook Entry
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Section | Select | Culture / Benefits / Policies / Tools / Onboarding |
| Audience | Multi-select | All / Engineering / New Hires / Managers |

---

### 3.6 Finance（财务）

#### Type: Vendor

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Vendor Name | Text | 供应商名称 |
| Category | Select | SaaS / Cloud / Payment / Shipping / Marketing / Legal |
| Status | Select | Active / Under Review / Inactive |
| Monthly Cost | Number | 月费 (CAD) |
| Contract Renewal | Date | 合同续期日期 |
| Contact Email | Text | 联系邮箱 |
| Website | URL | 供应商网站 |

**Relations**:
- Vendor *governed by* → Contract (1:N)

---

#### Type: Contract
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Contract Type | Select | SaaS / Service / Employment / NDA / Partnership |
| Start Date | Date | 开始日期 |
| End Date | Date | 结束日期 |
| Total Value | Number | 合同总价值 (CAD) |
| Auto Renew | Checkbox | 是否自动续期 |
| Signed By | Text | 签署人 |

**Relations**:
- Contract *belongs to* → Vendor (N:1)

---

#### Type: Budget Item

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Category | Select | Infrastructure / SaaS / Marketing / Payroll / Legal / Office |
| Period | Select | Monthly / Quarterly / Annual |
| Budgeted Amount | Number | 预算金额 (CAD) |
| Actual Amount | Number | 实际支出 (CAD) |
| Variance | Number | 差异 |

---

### 3.7 People & Culture（人事）

#### Type: Onboarding Checklist

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Role | Select | Engineer / Designer / PM / Marketing / Operations |
| Department | Select | Engineering / Design / Marketing / Operations / Finance |
| Status | Select | Not Started / In Progress / Completed |
| Due Date | Date | 完成期限 |
| Buddy | Text | 入职伙伴 |

---

#### Type: Training Material
> 派生自: Base Document

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Topic | Select | Technical / Product / Tool / Process / Culture |
| Format | Select | Document / Video / Workshop / Self-paced |
| Difficulty | Select | Beginner / Intermediate / Advanced |
| Duration | Text | 预计时长 (如 30min, 2h) |

---

#### Type: Role Description

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Department | Select | Engineering / Design / Marketing / Operations / Finance |
| Level | Select | Junior / Mid / Senior / Lead / Manager / Director |
| Status | Select | Active / Hiring / Frozen |
| Reports To | Text | 汇报对象 |

---

### 3.8 Meeting Notes（会议记录）

#### Type: Meeting Note

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Meeting Type | Select | Standup / Sprint Planning / Retrospective / Design Review / All Hands / 1:1 / Ad-hoc |
| Date | Date | 会议日期 |
| Attendees | Text | 参会人 |
| Action Items | Text | 待办事项摘要 |
| Department | Select | Engineering / Design / Marketing / Cross-functional |

---

## 4. Tags 系统

Tags 是跨 Type 复用的属性集。以下 Tags 可应用于多个 Types。

### Tag: Priority

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Priority Level | Select | P0 - Critical / P1 - High / P2 - Medium / P3 - Low |

**适用 Types**: Feature Spec, PRD, Bug Report, Campaign Plan, Content Piece

---

### Tag: Confidential

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Access Level | Select | Public / Internal / Restricted / Confidential |
| Reason | Text | 保密原因 |

**适用 Types**: Contract, Policy, Vendor, Budget Item, Role Description

---

### Tag: Clossette Module

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Product Module | Multi-select | AI Styling / 3D Try-On / Marketplace / Community / Cart & Checkout / Avatar / Designer Studio |

**适用 Types**: Feature Spec, PRD, Bug Report, Tech Design Doc, Design Asset

---

### Tag: Review Required

| 属性名 | 类型 | 说明 |
|--------|------|------|
| Reviewer | Text | 审核人 |
| Review Deadline | Date | 审核截止日期 |
| Review Status | Select | Pending / In Review / Approved / Rejected |

**适用 Types**: PRD, ADR, SOP, Policy, Contract, Tech Design Doc

---

## 5. Relations 关系图谱

```
PRD ─── drives (1:N) ───→ Feature Spec
 |                            |
 |                            |── decided by (N:N) ──→ ADR
 |                            |
 |                            └── produces (1:N) ───→ API Doc
 |
 └── informed by (N:N) ── User Research

Campaign ─── contains (1:N) ───→ Content Piece
    |
    └── promotes (N:N) ────────→ PRD

Vendor ─── governed by (1:N) ──→ Contract

Design Asset ─── visualizes (N:N) ──→ Feature Spec
```

### Relations 定义清单

| 源 Type | 关系名 (→) | 目标 Type | 关系名 (←) | 类型 |
|---------|-----------|-----------|-----------|------|
| PRD | drives | Feature Spec | implements | 1:N |
| PRD | informed by | User Research | informs | N:N |
| Feature Spec | decided by | ADR | affects | N:N |
| Feature Spec | produces | API Doc | documents | 1:N |
| Campaign Plan | contains | Content Piece | part of | 1:N |
| Campaign Plan | promotes | PRD | promoted by | N:N |
| Vendor | governed by | Contract | belongs to | 1:N |
| Design Asset | visualizes | Feature Spec | designed with | N:N |

---

## 6. 搭建顺序

### Phase 1: 基础框架（Day 1）

> 最小可用结构，覆盖最高频使用场景。

**Step 1: 创建 Enums（下拉菜单选项）**

在 Settings → Types 中，先创建所有会复用的 Select/Multi-select 枚举：

| Enum 名称 | 选项 |
|-----------|------|
| Document Status | Draft, In Review, Approved, Active, Archived |
| Priority Level | P0 - Critical, P1 - High, P2 - Medium, P3 - Low |
| Module | server, web, worker, infra |
| Department | Engineering, Design, Marketing, Operations, Finance, HR |
| Product Area | AI Styling, 3D Try-On, Marketplace, Community, Cart & Checkout, Avatar, Designer Studio |
| Complexity | S, M, L, XL |
| Access Level | Public, Internal, Restricted, Confidential |

**Step 2: 创建 Base Document Type**

1. Settings → Types → + 新建 Type
2. 名称: `Base Document`
3. 添加属性:
   - Status → Select → 选择 "Document Status" enum
   - Owner → Text
   - Last Reviewed → Date

**Step 3: 创建 Tags**

1. Settings → 选择 Base Document → Tags 区域 → +
2. 创建 `Priority` Tag → 添加属性 Priority Level (Select)
3. 创建 `Confidential` Tag → 添加属性 Access Level (Select), Reason (Text)
4. 创建 `Review Required` Tag → 添加属性 Reviewer (Text), Review Deadline (Date), Review Status (Select)

**Step 4: 创建核心 Spaces**

按第 2 节表格，先创建这 4 个 Space：
1. **Engineering** (Private)
2. **Product** (Private)
3. **Operations** (全员可见)
4. **Meeting Notes** (全员可见)

配置每个 Space 的 Owners 和 Members。

**Step 5: 派生核心 Types**

从 Base Document 派生：
1. `Feature Spec` — 添加 Epic, Module, Sprint, Complexity, Target Release
2. `ADR` — 添加 Decision Status, Decision Date, Deciders, Context, Consequences
3. `PRD` — 添加 Product Area, Target Persona, Business Impact, Target Release, Success Metrics
4. `SOP` — 添加 Department, Category, Review Cycle, Next Review, Compliance Required
5. `Meeting Note` (独立 Type) — 添加 Meeting Type, Date, Attendees, Action Items, Department

**Step 6: 定义核心 Relations**

1. PRD → Feature Spec: "drives" / "implements" (1:N)
2. PRD → User Research: "informed by" / "informs" (N:N)
3. Feature Spec → ADR: "decided by" / "affects" (N:N)

**Step 7: 创建第一批 Cards 验证**

每个 Type 创建 1-2 个示例 Card，验证：
- [ ] 属性填写是否顺畅
- [ ] Select 枚举选项是否完整
- [ ] Relations 连接是否正常工作
- [ ] Tags 应用是否符合预期
- [ ] 表格视图列是否清晰

---

### Phase 2A: Design + Marketing（第一批）

> 优先搭建与已有 Engineering/Product Types 有 Relations 的领域。

---

#### Step 2A-1: 创建新 Enums

以下 Enums 是 Phase 2A Types 需要但 Phase 1 未创建的：

| Enum 名称 | 选项 | 用于 |
|-----------|------|------|
| Asset Type | UI Mockup, Icon, Illustration, Photo, 3D Model, Video | Design Asset |
| Design Tool | Figma, Blender, Photoshop, Illustrator, Other | Design Asset |
| Asset Status | WIP, Ready for Review, Approved, Delivered | Design Asset |
| Component Category | Primitive, Composite, Layout, Motion, Token | Design System Entry |
| Component Status | Draft, Stable, Deprecated | Design System Entry |
| Guideline Area | Logo, Color, Typography, Imagery, Voice & Tone, Motion | Brand Guideline |
| Campaign Status | Planning, Active, Paused, Completed, Cancelled | Campaign Plan |
| Channel | Instagram, TikTok, Xiaohongshu, Email, PR, Paid Ads, SEO | Campaign + Channel Strategy |
| Target Audience | Gen Z, Young Professional, Designer | Campaign Plan |
| Content Type | Blog Post, Social Post, Email, Video, Press Release, Landing Page | Content Piece |
| Content Platform | Instagram, TikTok, Xiaohongshu, Website, Email, YouTube | Content Piece |
| Content Status | Ideation, Drafting, Review, Scheduled, Published | Content Piece |
| Review Cadence | Weekly, Monthly, Quarterly | Channel Strategy |
| Platform | Web, iOS, Android | Design Asset + Design System Entry |

操作：Settings → Types → 在添加属性时，选择 Select 或 Multi-select → 点 + 创建新 Enum → 输入名称和选项 → Save。

---

#### Step 2A-2: 创建 Design Space

1. Cards 模块 → **+ Create Space**
2. 名称: `Design`
3. Privacy: **Private**
4. Owners: 设计团队 Lead
5. Members: 所有设计师 + PM

---

#### Step 2A-3: 创建 Design Types

**Type 1: Design Asset（派生自 File Type）**

1. Settings → Types → 找到 Huly 内置的 `File` Type
2. 在 File 的 TYPES 区域 → + → 名称: `Design Asset`
3. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Asset Type | Select | Asset Type |
| + | Design Tool | Select | Design Tool |
| + | Version | Text | — |
| + | Status | Select | Asset Status |
| + | Platform | Multi-select | Platform |

4. 验证：创建一个测试 Card，确认文件上传区域出现（因为派生自 File Type）

**Type 2: Design System Entry（独立 Type）**

1. Settings → Types → + → 名称: `Design System Entry`
2. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Component Name | Text | — |
| + | Category | Select | Component Category |
| + | Platform | Multi-select | Platform |
| + | Status | Select | Component Status |
| + | Figma Link | URL | — |
| + | Code Path | Text | — |

**Type 3: Brand Guideline（派生自 Base Document）**

1. Settings → Types → 打开 `Base Document` → TYPES 区域 → +
2. 名称: `Brand Guideline`
3. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Guideline Area | Select | Guideline Area |
| + | Version | Text | — |

> 继承自 Base Document: Status, Owner, Last Reviewed

---

#### Step 2A-4: 创建 Design Relations

| 操作路径 | 源 Type | 关系名 (→) | 目标 Type | 关系名 (←) | 类型 |
|----------|---------|-----------|-----------|-----------|------|
| Settings → Design Asset → Relations → + | Design Asset | visualizes | Feature Spec | designed with | N:N |

验证：打开一个 Design Asset Card → 在 Relations 区域选择一个已存在的 Feature Spec → 确认双向链接出现。

---

#### Step 2A-5: 创建 Design 示例 Cards

| Card 标题 | Type | 关键属性 |
|-----------|------|---------|
| `Homepage Hero Mockup v2` | Design Asset | Asset Type: UI Mockup, Tool: Figma, Status: Approved |
| `Button` | Design System Entry | Category: Primitive, Platform: Web, Status: Stable, Code Path: web/components/ui/button.tsx |
| `Brand Color Palette` | Brand Guideline | Area: Color, Version: 1.0, Status: Active |

---

#### Step 2A-6: 创建 Marketing Space

1. Cards 模块 → **+ Create Space**
2. 名称: `Marketing`
3. Privacy: **Private**
4. Owners: 市场负责人
5. Members: 市场团队 + 创始人

---

#### Step 2A-7: 创建 Marketing Types

**Type 1: Campaign Plan（独立 Type）**

1. Settings → Types → + → 名称: `Campaign Plan`
2. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Campaign Name | Text | — |
| + | Status | Select | Campaign Status |
| + | Channel | Multi-select | Channel |
| + | Budget | Number | — |
| + | Start Date | Date | — |
| + | End Date | Date | — |
| + | Target Audience | Multi-select | Target Audience |
| + | KPI | Text | — |

**Type 2: Content Piece（独立 Type）**

1. Settings → Types → + → 名称: `Content Piece`
2. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Content Type | Select | Content Type |
| + | Platform | Select | Content Platform |
| + | Status | Select | Content Status |
| + | Publish Date | Date | — |
| + | Author | Text | — |
| + | Content Link | URL | — |

3. 添加 Tag：打开 Content Piece → Tags → + → 选择 `Priority`（复用 Phase 1 创建的 Tag）

**Type 3: Channel Strategy（派生自 Base Document）**

1. Settings → Types → 打开 `Base Document` → TYPES 区域 → +
2. 名称: `Channel Strategy`
3. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Channel | Select | Channel |
| + | Goal | Text | — |
| + | Review Cadence | Select | Review Cadence |

---

#### Step 2A-8: 创建 Marketing Relations

| 操作路径 | 源 Type | 关系名 (→) | 目标 Type | 关系名 (←) | 类型 |
|----------|---------|-----------|-----------|-----------|------|
| Settings → Campaign Plan → Relations → + | Campaign Plan | contains | Content Piece | part of | 1:N |
| Settings → Campaign Plan → Relations → + | Campaign Plan | promotes | PRD | promoted by | N:N |

验证：
1. 创建一个 Campaign Plan Card
2. 在 Relations 区域添加一个 Content Piece → 确认 1:N 关系正常
3. 在 Relations 区域添加一个已存在的 PRD → 确认跨 Space 链接正常

---

#### Step 2A-9: 创建 Marketing 示例 Cards

| Card 标题 | Type | 关键属性 |
|-----------|------|---------|
| `2026-Q3: Summer Collection Launch` | Campaign Plan | Channel: Instagram + TikTok, Budget: 5000, Status: Planning |
| `Summer Look Reveal Reel` | Content Piece | Type: Video, Platform: TikTok, Status: Ideation |
| `Instagram Growth Strategy` | Channel Strategy | Channel: Instagram, Cadence: Monthly |

---

#### Step 2A-10: 创建 Phase 2A Saved Views

| 视图名称 | Space | Type | 筛选条件 | 可见性 |
|----------|-------|------|---------|--------|
| Active Campaigns | Marketing | Campaign Plan | Status = Planning OR Active | Public |
| Content Calendar | Marketing | Content Piece | Status != Published, 按 Publish Date 排序 | Public |
| Design Review Queue | Design | Design Asset | Status = Ready for Review | Public |
| Stable Components | Design | Design System Entry | Status = Stable | Public |

操作：打开对应 Type 的表格视图 → 点 Filter → 设置条件 → Save as → 输入名称 → 选择 Public。

---

#### Phase 2A 验证清单

- [ ] Design Space 创建成功，成员权限正确
- [ ] Marketing Space 创建成功，成员权限正确
- [ ] Design Asset 派生自 File Type，文件上传区域正常
- [ ] Brand Guideline 和 Channel Strategy 继承了 Base Document 的 Status/Owner/Last Reviewed
- [ ] Design Asset → Feature Spec 的 N:N Relation 双向链接正常
- [ ] Campaign → Content Piece 的 1:N Relation 正常
- [ ] Campaign → PRD 的 N:N 跨 Space Relation 正常
- [ ] Priority Tag 成功应用到 Content Piece
- [ ] 4 个 Saved Views 创建并可在侧边栏访问
- [ ] 每个 Type 有 1-2 个示例 Card

**完成 Phase 2A 后，开始 Phase 2B**

---

### Phase 2B: Finance + People & Culture（第二批）

---

#### Step 2B-1: 创建新 Enums

| Enum 名称 | 选项 | 用于 |
|-----------|------|------|
| Vendor Category | SaaS, Cloud, Payment, Shipping, Marketing, Legal | Vendor |
| Vendor Status | Active, Under Review, Inactive | Vendor |
| Contract Type | SaaS, Service, Employment, NDA, Partnership | Contract |
| Budget Category | Infrastructure, SaaS, Marketing, Payroll, Legal, Office | Budget Item |
| Budget Period | Monthly, Quarterly, Annual | Budget Item |
| Role | Engineer, Designer, PM, Marketing, Operations | Onboarding Checklist |
| Onboarding Status | Not Started, In Progress, Completed | Onboarding Checklist |
| Training Topic | Technical, Product, Tool, Process, Culture | Training Material |
| Training Format | Document, Video, Workshop, Self-paced | Training Material |
| Difficulty | Beginner, Intermediate, Advanced | Training Material |
| Job Level | Junior, Mid, Senior, Lead, Manager, Director | Role Description |
| Job Status | Active, Hiring, Frozen | Role Description |
| Policy Area | Security, Privacy, HR, Finance, Legal, General | Policy |
| Handbook Section | Culture, Benefits, Policies, Tools, Onboarding | Company Handbook Entry |

---

#### Step 2B-2: 创建 Finance Space

1. Cards 模块 → **+ Create Space**
2. 名称: `Finance`
3. Privacy: **Private**（仅财务 + 创始人可见）
4. Owners: 财务负责人
5. Members: 创始人

> 重要: Finance Space 应严格限制访问。仅添加需要查看财务数据的人。

---

#### Step 2B-3: 创建 Finance Types

**Type 1: Vendor（独立 Type）**

1. Settings → Types → + → 名称: `Vendor`
2. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Vendor Name | Text | — |
| + | Category | Select | Vendor Category |
| + | Status | Select | Vendor Status |
| + | Monthly Cost | Number | — |
| + | Contract Renewal | Date | — |
| + | Contact Email | Text | — |
| + | Website | URL | — |

3. 添加 Tag：Confidential（复用 Phase 1 的 Tag）

**Type 2: Contract（派生自 Base Document）**

1. Settings → Types → 打开 `Base Document` → TYPES → +
2. 名称: `Contract`
3. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Contract Type | Select | Contract Type |
| + | Start Date | Date | — |
| + | End Date | Date | — |
| + | Total Value | Number | — |
| + | Auto Renew | Checkbox | — |
| + | Signed By | Text | — |

4. 添加 Tags：Confidential, Review Required

**Type 3: Budget Item（独立 Type）**

1. Settings → Types → + → 名称: `Budget Item`
2. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Category | Select | Budget Category |
| + | Period | Select | Budget Period |
| + | Budgeted Amount | Number | — |
| + | Actual Amount | Number | — |
| + | Variance | Number | — |

3. 添加 Tag：Confidential

---

#### Step 2B-4: 创建 Finance Relations

| 操作路径 | 源 Type | 关系名 (→) | 目标 Type | 关系名 (←) | 类型 |
|----------|---------|-----------|-----------|-----------|------|
| Settings → Vendor → Relations → + | Vendor | governed by | Contract | belongs to | 1:N |

验证：创建 Vendor Card "Stripe" → 在 Relations 添加一个 Contract → 确认链接正常。

---

#### Step 2B-5: 创建 Finance 示例 Cards

| Card 标题 | Type | 关键属性 |
|-----------|------|---------|
| `Stripe` | Vendor | Category: Payment, Status: Active, Monthly Cost: 0 (pay-per-use) |
| `Stripe - Payment Processing Agreement` | Contract | Type: SaaS, Auto Renew: Yes |
| `2026-Q3 Infrastructure` | Budget Item | Category: Infrastructure, Period: Quarterly |

---

#### Step 2B-6: 创建 People & Culture Space

1. Cards 模块 → **+ Create Space**
2. 名称: `People & Culture`
3. Privacy: **Private**
4. Owners: HR 负责人 / 创始人
5. Members: 管理层

---

#### Step 2B-7: 创建 People & Culture Types

**Type 1: Onboarding Checklist（独立 Type）**

1. Settings → Types → + → 名称: `Onboarding Checklist`
2. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Role | Select | Role |
| + | Department | Select | Department（复用 Phase 1 Enum） |
| + | Status | Select | Onboarding Status |
| + | Due Date | Date | — |
| + | Buddy | Text | — |

**Type 2: Training Material（派生自 Base Document）**

1. Settings → Types → 打开 `Base Document` → TYPES → +
2. 名称: `Training Material`
3. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Topic | Select | Training Topic |
| + | Format | Select | Training Format |
| + | Difficulty | Select | Difficulty |
| + | Duration | Text | — |

**Type 3: Role Description（独立 Type）**

1. Settings → Types → + → 名称: `Role Description`
2. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Department | Select | Department（复用 Phase 1 Enum） |
| + | Level | Select | Job Level |
| + | Status | Select | Job Status |
| + | Reports To | Text | — |

3. 添加 Tag：Confidential

---

#### Step 2B-8: 补充 Operations Types（Policy + Handbook）

Phase 1 只创建了 SOP。现在补充 Operations Space 的两个 Type：

**Type: Policy（派生自 Base Document）**

1. Settings → Types → 打开 `Base Document` → TYPES → +
2. 名称: `Policy`
3. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Policy Area | Select | Policy Area |
| + | Effective Date | Date | — |
| + | Expiry Date | Date | — |
| + | Approver | Text | — |

4. 添加 Tags：Confidential, Review Required

**Type: Company Handbook Entry（派生自 Base Document）**

1. Settings → Types → 打开 `Base Document` → TYPES → +
2. 名称: `Company Handbook Entry`
3. 添加属性：

| 操作 | 属性名 | 类型 | Enum |
|------|--------|------|------|
| + | Section | Select | Handbook Section |
| + | Audience | Multi-select | (创建新 Enum: All, Engineering, New Hires, Managers) |

---

#### Step 2B-9: 创建 People & Culture 示例 Cards

| Card 标题 | Type | 关键属性 |
|-----------|------|---------|
| `Engineer Onboarding - Day 1-5` | Onboarding Checklist | Role: Engineer, Dept: Engineering, Status: Not Started |
| `Git Workflow Guide` | Training Material | Topic: Technical, Format: Document, Difficulty: Beginner |
| `Senior Frontend Engineer` | Role Description | Dept: Engineering, Level: Senior, Status: Hiring |

---

#### Step 2B-10: 创建 Phase 2B Saved Views

| 视图名称 | Space | Type | 筛选条件 | 可见性 |
|----------|-------|------|---------|--------|
| Active Vendors | Finance | Vendor | Status = Active | Private |
| Expiring Contracts | Finance | Contract | End Date 按升序排列 | Private |
| Open Positions | People & Culture | Role Description | Status = Hiring | Public |
| Beginner Training | People & Culture | Training Material | Difficulty = Beginner | Public |
| Active Policies | Operations | Policy | Status = Active | Public |

---

#### Phase 2B 验证清单

- [ ] Finance Space 创建成功，**仅财务 + 创始人可见**
- [ ] People & Culture Space 创建成功，**仅 HR + 管理层可见**
- [ ] Vendor → Contract 的 1:N Relation 正常
- [ ] Contract 和 Training Material 继承了 Base Document 属性
- [ ] Confidential Tag 成功应用到 Vendor, Contract, Budget Item, Role Description
- [ ] Review Required Tag 成功应用到 Contract, Policy
- [ ] Policy 和 Company Handbook Entry 出现在 Operations Space
- [ ] 5 个 Saved Views 创建并可访问
- [ ] 每个 Type 有 1-2 个示例 Card

---

### Phase 3: 优化、迁移与治理

> Phase 2A + 2B 全部完成后执行。

---

#### Step 3-1: 创建全局 Saved Views

除了 Phase 2 中各领域的视图外，创建跨领域的全局高频视图：

| 视图名称 | Type | 筛选条件 | 用途 |
|----------|------|---------|------|
| Engineering: Active Feature Specs | Feature Spec | Status = Active | 工程团队日常查看 |
| Product: In Review PRDs | PRD | Status = In Review | PM 追踪审批进度 |
| All: My Owned Cards | (任意 Type) | Owner = [你的名字] | 快速找到自己负责的内容 |
| All: Needs Review | (任意 Type) | Review Required Tag → Review Status = Pending | 审核队列 |
| Operations: SOPs Due for Review | SOP | Next Review < 7 days | 运营定期维护 |
| Finance: Expiring Contracts | Contract | End Date < 30 days | 合同续期提醒 |

---

#### Step 3-2: 部署 Clossette Module Tag

将 `Clossette Module` Tag 应用到所有产品相关的已存在 Cards：

1. 打开每个产品相关 Card（Feature Spec, PRD, Tech Design Doc, Design Asset, Bug Report）
2. 点 + → 选择 `Clossette Module` Tag
3. 选择对应的模块：AI Styling / 3D Try-On / Marketplace / Community / Cart & Checkout / Avatar / Designer Studio

完成后验证：在任意 Type 的表格视图中，按 `Product Module` 列筛选，能跨 Space 看到同一模块的所有 Cards。

---

#### Step 3-3: 迁移现有文档

按优先级分三轮迁移：

**第一轮: PRD.md → PRD Card**

| 源文件 | 目标 Type | Card 标题 | Space |
|--------|-----------|-----------|-------|
| `PRD.md` | PRD | `PRD: Clossette - AI Fashion Marketplace` | Product |

操作：
1. 在 Product Space 创建 PRD Card
2. 设置属性：Product Area = (全选), Target Persona = (全选), Status = Active
3. 将 PRD.md 中的 Epics、API Contracts、Data Model 等内容复制到 Card 的富文本编辑器
4. 如果 PRD 太长，可按 Epic 拆分为多个 PRD Cards（每个 Epic 一个 Card），用 parent-child 关系组织

**第二轮: docs/ 技术文档 → 对应 Types**

| 源文件 | 目标 Type | Card 标题 | Space |
|--------|-----------|-----------|-------|
| `docs/CODEMAPS/architecture.md` | Tech Design Doc | `Architecture Overview` | Engineering |
| `docs/CODEMAPS/backend.md` | Tech Design Doc | `Backend Architecture Map` | Engineering |
| `docs/CODEMAPS/frontend.md` | Tech Design Doc | `Frontend Architecture Map` | Engineering |
| `docs/CODEMAPS/data.md` | Tech Design Doc | `Data Model Map` | Engineering |
| `docs/CODEMAPS/dependencies.md` | Tech Design Doc | `Dependency Map` | Engineering |
| `docs/meshy_Image-to-3D.md` | API Doc | `Meshy Image-to-3D API Reference` | Engineering |
| `docs/GEN-Pose.md` | Tech Design Doc | `Pose Generation Guide` | Engineering |

操作：
1. 每个文件创建对应的 Card
2. 设置 Module 属性（backend.md → server, frontend.md → web 等）
3. 复制 Markdown 内容到 Card 富文本编辑器（Huly 支持 Markdown 语法）
4. 如有代码块，Huly 会自动语法高亮

**第三轮: CLAUDE.md → Tech Design Doc**

| 源文件 | 目标 Type | Card 标题 | Space |
|--------|-----------|-----------|-------|
| `CLAUDE.md` (根) | Tech Design Doc | `Project Overview & Conventions` | Engineering |
| `server/CLAUDE.md` | Tech Design Doc | `Server Module Guide` | Engineering |
| `web/CLAUDE.md` | Tech Design Doc | `Web Module Guide` | Engineering |
| `worker/CLAUDE.md` | Tech Design Doc | `Worker Module Guide` | Engineering |

> **注意**: CLAUDE.md 文件同时服务于 AI 工具（Claude Code）和人类开发者。迁移到 Huly 后，保留原始 CLAUDE.md 文件不动（它们是 Claude Code 的上下文来源）。Huly Cards 作为团队知识库的「人类可读版本」，可以包含更多背景信息和决策原因。

---

#### Step 3-4: 建立维护节奏

根据第 8 节的治理规则，设置以下定期任务（可在 Huly Planner 或日历中创建循环事项）：

| 频率 | 活动 | 负责人 |
|------|------|--------|
| 每周一 | 审查 Review Required Tag → Review Status = Pending 的 Cards | 各 Space Owner |
| 每月 1 日 | 检查 SOP 的 Next Review 日期，更新过期 SOPs | Operations Owner |
| 每月 1 日 | 清理 Status = Archived 超过 90 天的 Cards（决定删除或保留） | 各 Space Owner |
| 每季度 | Finance: 审查 Vendor 合同续期日期，更新 Budget Items | 财务 |
| 每季度 | 审计 Clossette Module Tag 覆盖率（所有产品 Cards 都应有） | PM |
| 每半年 | 全面审计 Types/Tags/Relations 结构，移除未使用的属性和 Enums | 创始人 / Tech Lead |

---

#### Step 3-5: 集成已有工具

| 工具 | 操作 | 优先级 |
|------|------|--------|
| **GitHub** | Settings → Integrations → GitHub → 授权 → 关联 repo | 高 |
| **Google Calendar** | Settings → Integrations → Google Calendar → 授权 | 中 |
| **Figma** | 在 Design Asset / Design System Entry Cards 中用 URL 属性链接 | 中 |

---

#### Phase 3 验证清单

- [ ] 6+ 个全局 Saved Views 创建成功
- [ ] Clossette Module Tag 已应用到所有产品相关 Cards
- [ ] PRD.md 内容已迁移到 PRD Card
- [ ] docs/ 目录的 7 个文件已迁移到对应 Cards
- [ ] CLAUDE.md 系列已迁移到 Tech Design Doc Cards（原文件保留）
- [ ] 维护节奏已记录并通知相关负责人
- [ ] GitHub 集成已启用（如适用）
- [ ] 所有 Cards 都有 Owner 属性填写

---

## 7. 命名规范

### Types 命名
- 使用英文，Title Case（首字母大写）
- 简洁明确：`Feature Spec` 不是 `Feature Specification Document`
- 派生 Type 不重复父级名称：`ADR` 不是 `Base Document - ADR`

### Card 标题命名
| Type | 格式 | 示例 |
|------|------|------|
| Feature Spec | `[Module] Brief description` | `[web] Add cloth size selection to cart` |
| ADR | `ADR-NNN: Decision title` | `ADR-001: Use Stripe for payment processing` |
| PRD | `PRD: Feature name` | `PRD: AI-powered outfit recommendations` |
| SOP | `SOP: Process name` | `SOP: Production deployment procedure` |
| Campaign | `YYYY-QN: Campaign name` | `2026-Q3: Summer launch campaign` |
| Bug Report | `[Severity] Brief description` | `[Critical] Cart total incorrect with size variants` |
| Meeting Note | `YYYY-MM-DD Type: Topic` | `2026-06-19 Sprint Planning: Sprint-25` |
| Vendor | Company name | `Stripe` |
| Contract | `Vendor - Contract type` | `Stripe - Payment processing agreement` |

### Enum 值命名
- 使用 Title Case
- 保持一致风格：推荐全英文（因为 Huly 界面为英文）

---

## 8. 维护与治理

### 审核节奏

| 频率 | 活动 |
|------|------|
| 每周 | 审查 "In Review" 状态的 Cards，推进审批 |
| 每月 | 检查 SOP 审核日期，更新过期内容 |
| 每季度 | 审查 Vendor 合同续期日期，清理 Archived Cards |
| 每半年 | 全面审计 Types/Tags 结构，移除未使用的属性 |

### 知识库卫生规则

1. **每个 Card 必须有 Owner** — 无主 Card 会腐化
2. **Status 必须及时更新** — Draft → In Review → Approved/Archived
3. **Relations 优于 Mentions** — 用结构化 Relation，不要在正文里 @ 链接
4. **不要在 Cards 里放临时笔记** — 临时内容用 Documents，确认后迁入 Cards
5. **新入职员工第一周** — 浏览 Operations Space 的 SOP 和 Handbook，熟悉流程

### 权限治理

| 角色 | 权限范围 |
|------|---------|
| 创始人 / CEO | 所有 Spaces 的 Owner |
| Tech Lead | Engineering + Product Spaces 的 Member |
| 设计师 | Design + Product Spaces 的 Member |
| 市场负责人 | Marketing Space 的 Owner |
| 财务 | Finance Space 的 Owner（其他人不可见） |
| 全员 | Operations + Meeting Notes Spaces 的 Member |

---

## 附录 A: Huly Documents vs Cards 使用指南

| 场景 | 用什么 | 原因 |
|------|--------|------|
| 每周团队周报 | Documents | 自由格式，不需要筛选 |
| 会议记录（需按类型筛选） | Cards (Meeting Note) | 需要按 Meeting Type 筛选和排序 |
| 产品需求文档 | Cards (PRD) | 需要 Status 跟踪、Relations、筛选 |
| 头脑风暴草稿 | Documents | 临时内容，确认后迁入 Cards |
| 技术方案评审 | Cards (Tech Design Doc) | 需要 Review Status 和 Module 属性 |
| 公司文化宣言 | Documents | 长文内容，不需结构化属性 |
| 供应商管理 | Cards (Vendor) | 需要合同续期日期筛选和排序 |

---

## 附录 B: 与现有工具的集成建议

| 工具 | 集成方式 | 用途 |
|------|---------|------|
| GitHub | Huly 内置 GitHub 集成 | 将 Issues/PRs 关联到 Feature Spec Cards |
| Figma | Design Asset Card 的 URL 属性 | 链接到设计文件 |
| Stripe | Vendor Card + Contract Card | 记录支付服务合同 |
| Google Calendar | Huly 内置 Google Calendar 集成 | 同步会议到 Meeting Notes |
| Slack/Discord | 手动或通过 Huly Chat | 讨论链接回 Cards |

---

## 附录 C: 快速参考

```
创建新 Type:
Settings → Types → [+] → 输入名称 → Create → 添加属性

派生子 Type:
打开父 Type → TYPES 区域 → [+] → 输入名称 → Create

创建 Tag:
Settings → 选择 Type → Tags 区域 → [+] → 输入名称 → Create → 添加属性

定义 Relation:
Settings → 选择 Type → Relations 区域 → [+] → 选择目标 Type
→ 设置双向名称 → 选择类型 (1:1 / 1:N / N:N)

创建 Space:
Cards 模块 → [+ Create Space] → 配置名称、Types、Members、Privacy

创建 Card:
选择正确的 Type → [+ Create Card] → 填写属性 → 编辑正文
→ 添加 Tags → 建立 Relations

保存筛选视图:
设置 Filter → [Save as] → 输入名称 → 选择 Public / Private
```
