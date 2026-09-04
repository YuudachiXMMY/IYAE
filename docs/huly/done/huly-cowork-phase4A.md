# Huly Phase 4A: Tracker Setup — Browser Automation Instructions

> Target: Huly Cloud (app.huly.io), workspace with Phase 1-3 Cards already completed
> Scope: Full Tracker configuration — Space Type, Task Types, Projects, Components, Labels, Milestones, Issue Templates, GitHub integration
> Prerequisite: Phase 1-3 Cards complete (20+ Types, 8 Card Spaces, 4 Tags, 6 Relations)
> Estimated: ~80 browser actions

---

## PRE-FLIGHT CHECK

Before starting, verify the workspace has Phase 1-3 completed:

1. Navigate to Cards module in the left sidebar
2. Confirm 8 Card Spaces exist: Engineering, Product, Design, Marketing, Operations, Finance, People & Culture, Meeting Notes
3. Navigate to Tracker module (checkbox icon in the left sidebar)
4. Confirm NO projects exist yet (fresh Tracker)

If the Tracker already has projects, ask the user before proceeding.

---

## TASK 1: Create Labels (Workspace-level)

Labels are workspace-wide and reusable across all Projects. Create them first.

Navigate to Tracker → find "Labels" in the left sidebar → click on it.

Create the following labels by clicking `+ Add label` for each:

| Label Name | Color | Description |
|------------|-------|-------------|
| `frontend` | Blue | Frontend/UI related |
| `backend` | Green | Server/API related |
| `worker` | Purple | Background worker/3D pipeline |
| `infrastructure` | Gray | DevOps, CI/CD, deployment |
| `AI` | Orange | AI/ML features (styling, chat) |
| `3D` | Cyan | 3D models, GLB, try-on |
| `UX` | Pink | User experience improvements |
| `performance` | Yellow | Performance optimization |
| `security` | Red | Security related |
| `documentation` | Light Gray | Docs, guides, READMEs |
| `design-system` | Teal | Design system components |
| `content` | Light Blue | Marketing content |
| `campaign` | Magenta | Marketing campaigns |
| `blocker` | Dark Red | Blocks other work |

For each label:
1. Click `+ Add label`
2. Enter the title
3. Enter the description
4. Select a color (pick the closest available color)
5. Click Create

---

## TASK 2: Create Custom Space Type with Task Types

### Step 2.1: Create the Space Type

1. Navigate to Settings (gear icon in left sidebar or bottom-left)
2. Find "SPACE TYPES" section in the left settings menu
3. Click `+` next to "SPACE TYPES"
4. Base it on: `Tracker`
5. Name: `Clossette Project`
6. If offered to base on "Classic project" template, select Yes (to get the default Issue task type as a starting point)
7. Click Create

### Step 2.2: Customize the default Issue Task Type → rename to "Feature"

1. Click on `Clossette Project` to open it
2. Find the TASK TYPES section
3. Click on the default `Issue` task type
4. Rename it to `Feature`
5. Modify Process States to:

| State Name | Status Category | Color |
|------------|----------------|-------|
| `Backlog` | Backlog | Gray |
| `Refined` | Active | Blue |
| `In Progress` | Active | Blue |
| `In Review` | Active | Yellow |
| `QA` | Active | Orange |
| `Done` | Done | Green |
| `Cancelled` | Cancelled | Red |

To modify states:
- Click on each existing state to rename it or change its category
- Use `+` to add new states (Refined, In Review, QA)
- Remove states that don't match by clicking the delete/trash icon
- Make sure the Status Category is set correctly for each state — this controls automatic transitions

### Step 2.3: Create "Bug" Task Type

1. In the `Clossette Project` space type → TASK TYPES section
2. Click `+` to add a new task type
3. Name: `Bug`
4. Enable sub-tasks if the option exists
5. Set Process States:

| State Name | Status Category | Color |
|------------|----------------|-------|
| `Reported` | Backlog | Gray |
| `Triaging` | Active | Blue |
| `Fix In Progress` | Active | Blue |
| `Verifying` | Active | Yellow |
| `Resolved` | Done | Green |
| `Won't Fix` | Cancelled | Red |

### Step 2.4: Create "Chore" Task Type

1. Click `+` in TASK TYPES
2. Name: `Chore`
3. Set Process States:

| State Name | Status Category | Color |
|------------|----------------|-------|
| `Todo` | Active | Blue |
| `In Progress` | Active | Blue |
| `Done` | Done | Green |

### Step 2.5: Create "Spike" Task Type

1. Click `+` in TASK TYPES
2. Name: `Spike`
3. Set Process States:

| State Name | Status Category | Color |
|------------|----------------|-------|
| `Proposed` | Backlog | Gray |
| `Researching` | Active | Blue |
| `Concluded` | Done | Green |
| `Abandoned` | Cancelled | Red |

### Step 2.6: Create "Design Task" Task Type

1. Click `+` in TASK TYPES
2. Name: `Design Task`
3. Set Process States:

| State Name | Status Category | Color |
|------------|----------------|-------|
| `Backlog` | Backlog | Gray |
| `In Design` | Active | Blue |
| `Design Review` | Active | Yellow |
| `Ready for Dev` | Done | Green |
| `Cancelled` | Cancelled | Red |

### Step 2.7: Create "Content Task" Task Type

1. Click `+` in TASK TYPES
2. Name: `Content Task`
3. Set Process States:

| State Name | Status Category | Color |
|------------|----------------|-------|
| `Ideation` | Backlog | Gray |
| `Drafting` | Active | Blue |
| `Review` | Active | Yellow |
| `Scheduled` | Active | Orange |
| `Published` | Done | Green |
| `Cancelled` | Cancelled | Red |

---

## TASK 3: Create 4 Tracker Projects

Navigate to Tracker module (checkbox icon in left sidebar).

### Project 1: Platform

1. Click `+` icon next to "Your Projects" (or use `+ New issue` dropdown → Create project)
2. Configure:
   - **Project Type**: `Clossette Project` (the custom type we just created)
   - **Title**: `Platform`
   - **Identifier**: `PLT`
   - **Description**: `Server (Spring Boot) + Worker (Python) — API, business logic, 3D pipeline`
   - **Default Status**: `Backlog`
   - **Default Assignee**: (leave empty or set to yourself)
   - **Privacy**: Private
   - **Members**: Add all engineers
3. Click Create

### Project 2: Web

1. Click `+` to create another project
2. Configure:
   - **Project Type**: `Clossette Project`
   - **Title**: `Web`
   - **Identifier**: `WEB`
   - **Description**: `Next.js frontend — pages, components, styling, E2E tests`
   - **Default Status**: `Backlog`
   - **Privacy**: Private
   - **Members**: Add frontend engineers + designers
3. Click Create

### Project 3: Design

1. Click `+` to create another project
2. Configure:
   - **Project Type**: `Clossette Project`
   - **Title**: `Design`
   - **Identifier**: `DSN`
   - **Description**: `UI/UX design, brand assets, design system`
   - **Default Status**: `Backlog`
   - **Privacy**: Private
   - **Members**: Add designers + PM
3. Click Create

### Project 4: Marketing

1. Click `+` to create another project
2. Configure:
   - **Project Type**: `Clossette Project`
   - **Title**: `Marketing`
   - **Identifier**: `MKT`
   - **Description**: `Marketing campaigns, content creation, channel management`
   - **Default Status**: `Backlog`
   - **Privacy**: Private
   - **Members**: Add marketing team + founder
3. Click Create

---

## TASK 4: Create Components (per Project)

Components represent Clossette's product modules. Since Components are project-level, create them in the relevant projects.

### Platform Project Components

Navigate to Tracker → Platform project → find "Components" in the left sidebar under this project.

| Component | Description | Lead |
|-----------|-------------|------|
| `AI Styling` | AI chat, outfit recommendations, provider integration | — |
| `3D Pipeline` | Model generation, avatar, rigging, GLB processing | — |
| `Marketplace` | Product catalog, designer store, search | — |
| `Cart & Checkout` | Cart, size selection, Stripe checkout, orders | — |
| `Auth & Users` | Authentication, registration, profiles, email | — |
| `Community` | Posts, follows, likes, comments | — |

For each: click `+ Component` → enter title + description → Create.

### Web Project Components

Navigate to Tracker → Web project → Components.

| Component | Description | Lead |
|-----------|-------------|------|
| `AI Styling` | AI chat UI, suggestion chips, outfit display | — |
| `3D Viewer` | Three.js viewer, AR, pose animation, fitting | — |
| `Marketplace` | Product pages, search, designer profiles | — |
| `Cart & Checkout` | Cart UI, size selector, checkout flow | — |
| `Community` | Feed, post creation, profile pages | — |
| `Design System` | Shared components, shadcn/ui, tokens | — |
| `Auth & Registration` | Login, register wizard, profile dashboard | — |

### Design Project Components

Navigate to Tracker → Design project → Components.

| Component | Description | Lead |
|-----------|-------------|------|
| `UI/UX` | Page designs, user flows, prototypes | — |
| `Brand` | Logo, colors, typography, brand guidelines | — |
| `Marketing Assets` | Social media graphics, campaign visuals | — |

### Marketing Project Components

Navigate to Tracker → Marketing project → Components.

| Component | Description | Lead |
|-----------|-------------|------|
| `Social Media` | Instagram, TikTok, Xiaohongshu content | — |
| `Content` | Blog posts, email campaigns, PR | — |
| `Campaigns` | Launch campaigns, seasonal promotions | — |

---

## TASK 5: Create Milestones (initial set)

Since the team uses continuous delivery (no fixed sprints), Milestones represent releases.

### Platform Project Milestones

Navigate to Tracker → Platform → Milestones → `+ Milestone`

| Milestone | Description | Status | Deadline |
|-----------|-------------|--------|----------|
| `v1.0 - MVP` | Core marketplace + AI chat + 3D try-on | Completed | — |
| `v1.1 - Checkout` | Stripe checkout, order management, cart sizes | Completed | — |
| `v1.2 - Community` | Posts, follows, designer profiles | Completed | — |
| `v1.3 - Next` | Next planned release (update name as scope is defined) | Planned | — |

### Web Project Milestones

| Milestone | Description | Status | Deadline |
|-----------|-------------|--------|----------|
| `v1.0 - MVP` | Core pages, AI chat, 3D viewer | Completed | — |
| `v1.1 - Checkout` | Cart size selector, checkout flow | Completed | — |
| `v1.2 - Community` | Community feed, profile pages | Completed | — |
| `v1.3 - Next` | Next planned release | Planned | — |

### Design + Marketing Milestones

For Design and Marketing, create one initial milestone each:

| Project | Milestone | Description | Status |
|---------|-----------|-------------|--------|
| Design | `Brand v1` | Initial brand identity and design system | Planned |
| Marketing | `Launch Campaign` | First marketing push | Planned |

---

## TASK 6: Create Issue Templates

Issue Templates are project-specific. Create them for Platform and Web (the most active engineering projects).

### Platform Project Templates

Navigate to Tracker → Platform → Templates → `+ New template`

**Template 1: Bug Report**
- Title: `[Bug] <brief description>`
- Priority: High
- Description content:
```
## Description
What happened?

## Steps to Reproduce
1.
2.
3.

## Expected Behavior


## Actual Behavior


## Environment
- [ ] Production
- [ ] Staging
- [ ] Development

## Screenshots / Logs
```
- Labels: (leave empty, user will select)
- Default Task Type: Bug (if selectable)

**Template 2: Feature Request**
- Title: `[Feature] <brief description>`
- Priority: Medium
- Description content:
```
## Summary
What feature is needed?

## User Story
As a [type of user], I want [goal] so that [benefit].

## Acceptance Criteria
- [ ]
- [ ]

## Design Link
(Figma link if available)

## Related PRD
(Link to PRD Card in Huly Cards)
```
- Default Task Type: Feature (if selectable)

### Web Project Templates

Create the same two templates (Bug Report, Feature Request) with identical content for the Web project.

**Template 3: Design Handoff** (Web project only)
- Title: `[Design] <component/page name>`
- Priority: Medium
- Description content:
```
## Design
Figma link:

## Components to Create/Modify
-

## Responsive Breakpoints
- [ ] Mobile (< 768px)
- [ ] Tablet (768-1024px)
- [ ] Desktop (> 1024px)

## Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader labels
- [ ] Color contrast
```
- Labels: `UX`, `design-system`

---

## TASK 7: GitHub Integration

### Step 7.1: Connect GitHub Account

1. Click your profile avatar (bottom-left or top area)
2. Select "Integrations" or navigate to Settings → Integrations
3. Find "GitHub integration"
4. Click "Add"
5. Authorize the Huly GitHub App when prompted
6. Log in to GitHub if required

### Step 7.2: Map Repository to Projects

1. After authorization, click "Mapped GitHub Repositories"
2. Install the GitHub App on the Clossette repository
3. Select the `Clossette` repository
4. Map it to **Platform** project using the "Connect to Huly" dropdown
5. If possible, also map the same repo to **Web** project

> Note: If Huly only allows one repo → one project mapping, map it to Platform (which covers the most critical server/worker code). Web project can reference Platform issues.

6. Do NOT map the repository to Design or Marketing projects

### Step 7.3: Verify Sync

1. Create a test issue in Platform project: title `[Test] GitHub sync verification`
2. Check GitHub repository → Issues tab → verify the issue appears
3. Add a comment on the Huly issue → verify it appears on GitHub
4. Delete or close the test issue after verification

---

## TASK 8: Create Verification Issues (1 per Project)

### Issue 1: Platform Feature

1. Navigate to Tracker → Platform project
2. Click `+ New issue`
3. Configure:
   - Task Type: `Feature`
   - Title: `[Feature] Add avatar pose presets API endpoint`
   - Status: `Backlog`
   - Priority: `Medium`
   - Component: `3D Pipeline`
   - Labels: `backend`, `3D`
   - Milestone: `v1.3 - Next`
4. Add description: `Add REST endpoint for retrieving available pose presets for avatar animation.`

### Issue 2: Web Bug

1. Navigate to Tracker → Web project
2. Click `+ New issue`
3. Configure:
   - Task Type: `Bug`
   - Title: `[Bug] Size selector not updating cart total on mobile`
   - Status: `Reported`
   - Priority: `High`
   - Component: `Cart & Checkout`
   - Labels: `frontend`, `UX`
4. Add description: `On mobile devices, changing the selected size in cart does not update the total price display.`

### Issue 3: Design Task

1. Navigate to Tracker → Design project
2. Click `+ New issue`
3. Configure:
   - Task Type: `Design Task`
   - Title: `[Design] Community feed card redesign`
   - Status: `Backlog`
   - Priority: `Medium`
   - Component: `UI/UX`
   - Labels: `UX`

### Issue 4: Marketing Content Task

1. Navigate to Tracker → Marketing project
2. Click `+ New issue`
3. Configure:
   - Task Type: `Content Task`
   - Title: `[Content] Summer collection launch reel for TikTok`
   - Status: `Ideation`
   - Priority: `Medium`
   - Component: `Social Media`
   - Labels: `content`, `campaign`

---

## TASK 9: Configure Kanban Views

For each project, switch to Kanban view to verify states display correctly.

1. Navigate to Tracker → Platform → select `Feature` task type
2. Click the Kanban icon (grid icon in top-right)
3. Verify columns match: Backlog → Refined → In Progress → In Review → QA → Done
4. Repeat for `Bug` task type: Reported → Triaging → Fix In Progress → Verifying → Resolved

5. Navigate to Web project → verify same views
6. Navigate to Design project → verify `Design Task`: Backlog → In Design → Design Review → Ready for Dev
7. Navigate to Marketing project → verify `Content Task`: Ideation → Drafting → Review → Scheduled → Published

---

## COMPLETION CHECKLIST

After all tasks, verify and report:

- [ ] 14 workspace-level Labels created
- [ ] 1 custom Space Type `Clossette Project` with 6 Task Types (Feature, Bug, Chore, Spike, Design Task, Content Task)
- [ ] 4 Projects created: Platform (PLT), Web (WEB), Design (DSN), Marketing (MKT)
- [ ] Components created per project (Platform: 6, Web: 7, Design: 3, Marketing: 3)
- [ ] Initial Milestones set (Platform: 4, Web: 4, Design: 1, Marketing: 1)
- [ ] Issue Templates created (Platform: 2, Web: 3)
- [ ] GitHub integration connected and repo mapped to Platform (and Web if possible)
- [ ] 4 verification Issues created (1 per project)
- [ ] Kanban views showing correct columns for each Task Type
- [ ] Issues auto-appear in Assignee's Planner when set to active status
