# Huly Phase 4C: Documents Module Setup — Browser Automation Instructions

> Target: Huly Cloud (app.huly.io), workspace with Phase 1-3 Cards + Phase 4A Tracker + Phase 4B Processes completed
> Scope: Documents module — document spaces (Teamspaces), wiki structure, templates, starter documents
> Prerequisite: Phase 1-3 Cards (20+ Types, 8 Spaces) + Phase 4A Tracker (3 Projects) + Phase 4B Processes (5 Processes)
> Design Principle: Documents vs Cards separation per Appendix A — Documents for free-form wiki/unstructured content; Cards for structured data with attributes, relations, and filtering
> Note: Documents is a core Huly module but UI may differ across versions. This guide uses an adaptive approach — screenshot and verify UI before each configuration step.
> Estimated: ~50 browser actions

---

## PRE-FLIGHT CHECK

Before starting, verify the workspace is ready:

1. Navigate to Cards module → confirm 8 Card Spaces exist (+ Default = 9 total)
2. Navigate to Tracker module → confirm 3 active Projects exist: Clossette (CLOSS), Design (DSN), Marketing (MARKE)
3. Navigate to Processes module (⚡) → confirm 5 Processes exist (Content Publishing, Document Approval, Contract Lifecycle, Onboarding, Campaign Lifecycle)
4. **Find the Documents module** in the left sidebar (it should appear as a distinct module icon, typically a document/page icon)
5. Click on Documents → take a screenshot of the initial UI
6. If Documents module is NOT visible:
   - Check Settings → look for module visibility toggles
   - Try the bottom of the left sidebar for hidden/disabled modules
   - If still not found, screenshot the left sidebar and ask the user

**IMPORTANT**: At each TASK, take a screenshot first, then match the instructions to what you see. If the UI significantly differs, describe what you see and ask the user before proceeding.

---

## TASK 1: Explore Documents Module UI

This is a discovery task. Do NOT create anything yet.

1. Navigate to the Documents module
2. Take a screenshot of the main interface
3. Look for and report:
   - Is there a way to create "Teamspaces" or "Spaces" for organizing documents? (e.g., `+` button, "Create Teamspace")
   - Are there any pre-existing/example documents or teamspaces?
   - What document creation options exist? (blank document, from template, etc.)
   - Is there a template system? (e.g., "Templates" section, "Create Template")
   - Does the document editor support Markdown, rich text, or both?
   - Can documents be nested (parent-child hierarchy / folders)?
   - Can documents be linked to Cards or Tracker Issues?
4. Navigate to Settings → look for any Documents-related configuration
5. Take a screenshot of relevant Settings sections
6. Report your findings before proceeding to TASK 2

> Based on your findings, the remaining TASKs describe the expected configuration. Adapt the steps to match the actual UI.

---

## TASK 2: Create Document Teamspaces

Create 4 Document Teamspaces that complement (not duplicate) the 8 Card Spaces. These cover content that is **free-form and does not need structured attributes/filtering** (per Appendix A: Documents vs Cards separation).

### Teamspace 1: Company Wiki

1. In the Documents module, click the create/add button for new Teamspace
2. Name: `Company Wiki`
3. Description: `Company-wide knowledge base — culture, onboarding, tools, processes`
4. Visibility: **All members**
5. Icon/emoji: pick a house or book icon if available
6. Save / Create
7. Take a screenshot to verify

> Rationale: Operations Space (Cards) holds structured SOP/Policy/Handbook Cards with attributes. Company Wiki (Documents) holds the free-form narrative versions — onboarding reading lists, culture manifesto, tool setup guides.

### Teamspace 2: Engineering Wiki

1. Create a new Teamspace
2. Name: `Engineering Wiki`
3. Description: `Technical guides, runbooks, dev setup, architecture notes`
4. Visibility: **Private** (engineers only)
5. Save / Create
6. Take a screenshot

> Rationale: Engineering Space (Cards) holds structured Tech Design Docs, ADRs, API Docs with attributes like Module, Review Status. Engineering Wiki (Documents) holds free-form setup guides, troubleshooting runbooks, informal architecture notes.

### Teamspace 3: Product & Design Wiki

1. Create a new Teamspace
2. Name: `Product & Design Wiki`
3. Description: `Brainstorms, research drafts, design principles, user personas`
4. Visibility: **Private** (PM + designers)
5. Save / Create
6. Take a screenshot

> Rationale: Product Space (Cards) holds PRDs, User Research with structured attributes. This wiki holds draft-stage content, brainstorm notes, and design philosophy documents that may later be promoted to Cards.

### Teamspace 4: Meeting Agendas & Reports

1. Create a new Teamspace
2. Name: `Meeting Agendas & Reports`
3. Description: `Weekly reports, meeting prep agendas, retrospective notes`
4. Visibility: **All members**
5. Save / Create
6. Take a screenshot

> Rationale: Meeting Notes Space (Cards) holds structured meeting records with Meeting Type, Date, Attendees attributes for filtering. This Teamspace holds free-form weekly status updates and meeting agendas (prep docs before a meeting, not records after).

---

## TASK 3: Build Engineering Wiki Structure

Create a nested document hierarchy within the Engineering Wiki teamspace.

### Section 1: Development Setup

1. Navigate to `Engineering Wiki` teamspace
2. Create a new document: `Development Setup`
3. In the document body, add a brief intro:
   ```
   Local development environment setup guides for each module.
   ```
4. Create child documents under `Development Setup`:

   **Child 1: Local Environment Setup**
   - Title: `Local Environment Setup`
   - Body content:
   ```
   ## Prerequisites
   - Docker + Docker Compose
   - Java 22 (for server)
   - Node.js (for web)
   - Python 3.12 (for worker)

   ## Quick Start
   ./dev.sh setup    # First-time setup
   ./dev.sh start    # Start all services
   ./dev.sh status   # Check health

   ## Port Mappings
   | Service | Host Port | Container Port |
   |---------|-----------|----------------|
   | Web | 3000 | 3000 |
   | API | 3001 | 8080 |
   | MySQL | 3002 | 3306 |
   | Mailpit SMTP | 1025 | 1025 |
   | Mailpit UI | 8025 | 8025 |

   ## Without Docker
   See root CLAUDE.md "Local Development" section for per-module commands.
   ```

   **Child 2: Environment Variables Guide**
   - Title: `Environment Variables Guide`
   - Body: Brief overview of .env.example with notes on which variables are required vs optional. Reference the CLAUDE.md table.

### Section 2: Runbooks

1. Create a new document in `Engineering Wiki`: `Runbooks`
2. Body intro:
   ```
   Operational runbooks for common tasks and incident response.
   ```
3. Create child documents:

   **Child 1: Production Deployment**
   - Title: `Production Deployment Runbook`
   - Body content:
   ```
   ## Steps
   1. ./prod_deploy.sh update    # git pull + rebuild + restart
   2. ./prod_deploy.sh health    # Verify containers + HTTP + SSL

   ## SSL Certificate
   - Initial: ./prod_deploy.sh ssl-init <domain>
   - Renewal: ./prod_deploy.sh ssl-renew

   ## Rollback
   If deployment fails:
   1. Check logs: ./prod_deploy.sh logs [service]
   2. Rollback: git revert + ./prod_deploy.sh update
   ```

   **Child 2: Database Operations**
   - Title: `Database Operations Runbook`
   - Body content:
   ```
   ## Backup
   ./dev.sh db backup    # Creates timestamped SQL dump

   ## Restore
   ./dev.sh db restore <file>    # Prompts for confirmation

   ## Migrations
   - Flyway only (Hibernate ddl-auto: validate)
   - Add new: server/src/main/resources/db/migration/V{N}__description.sql
   - Current: 10 migrations (V1-V10)
   ```

### Section 3: Architecture Notes

1. Create a new document: `Architecture Notes`
2. Body intro:
   ```
   Informal architecture notes and decision context.
   For formal architecture decisions, use ADR Cards in the Engineering Card Space.
   ```
3. Leave empty for now — this is a landing page for future informal notes.

---

## TASK 4: Build Product & Design Wiki Structure

Create nested document hierarchy within the Product & Design Wiki teamspace.

### Section 1: Brainstorms

1. Navigate to `Product & Design Wiki` teamspace
2. Create a new document: `Brainstorms`
3. Body intro:
   ```
   Draft ideas and brainstorm sessions.
   When an idea is validated, promote it to a PRD Card in the Product Card Space.
   ```
4. Create one example child document:

   **Child: [Draft] AI Outfit Recommendation Improvements**
   - Title: `[Draft] AI Outfit Recommendation Improvements`
   - Body content:
   ```
   ## Problem
   Current AI styling only suggests outfits based on text chat.
   Users want visual-first interaction.

   ## Ideas
   - "Style this look" — upload a photo, get similar items from marketplace
   - "Complete my outfit" — select one item, AI suggests complementary pieces
   - Mood board → outfit generation

   ## Status
   Draft — needs user research before promoting to PRD Card.
   ```

### Section 2: User Personas

1. Create a new document: `User Personas`
2. Body content:
   ```
   ## Primary Personas

   ### Maya — Gen Z Fashion Explorer (18-24)
   - Values: self-expression, sustainability, uniqueness
   - Pain points: decision fatigue, returns, "nothing to wear" feeling
   - Tech: mobile-first, heavy social media user
   - Goal: discover indie designers, visualize before buying

   ### Sophia — Young Professional (25-30)
   - Values: quality, efficiency, curated style
   - Pain points: limited shopping time, fit uncertainty
   - Tech: desktop + mobile, values streamlined UX
   - Goal: build a capsule wardrobe, minimize returns

   ### Leo — Indie Designer
   - Values: visibility, fair marketplace, community
   - Pain points: competing with fast fashion, reaching target audience
   - Tech: comfortable with design tools
   - Goal: showcase collections, connect with style-conscious buyers
   ```

### Section 3: Design Principles

1. Create a new document: `Design Principles`
2. Body content:
   ```
   ## Clossette Design Principles

   1. **Show, don't describe** — Use 3D visualization over text descriptions
   2. **Reduce friction** — Every extra click loses a Gen Z user
   3. **Celebrate indie** — Spotlight designer stories, not just products
   4. **Mobile-native** — Design mobile-first, enhance for desktop
   5. **Inclusive sizing** — Size selection and body-positive avatar representation
   6. **Dark mode native** — All colors use semantic tokens, never hardcoded

   ## UI Conventions
   - shadcn/ui primitives (do not edit by hand)
   - Semantic color tokens: bg-background, bg-card, text-foreground, etc.
   - CSS gradient variables with dark mode overrides in globals.css
   ```

---

## TASK 5: Build Company Wiki Structure

Create nested document hierarchy within the Company Wiki teamspace.

### Section 1: About Clossette

1. Navigate to `Company Wiki` teamspace
2. Create a new document: `About Clossette`
3. Body content:
   ```
   ## Vision
   Help shoppers go from "I have nothing to wear" to "I feel great about this look"
   through AI-guided styling, 3D visualization, and a curated indie designer marketplace
   — with near-zero returns.

   ## Target Audience
   Gen Z and young millennial shoppers (18-30)

   ## Core Product Pillars
   1. AI Conversational Styling — chat-based outfit recommendations
   2. 3D/AR Virtual Try-On — see clothes on your avatar before buying
   3. Indie Designer Marketplace — discover unique fashion from independent creators
   4. Community — share looks, follow designers, engage with fashion content

   ## Tech Stack
   - Frontend: Next.js 16 (TypeScript)
   - Backend: Spring Boot 3.4 (Java 22)
   - 3D Worker: Python 3.12
   - Database: MySQL 8
   - Infra: Docker Compose, Nginx (production)
   ```

### Section 2: Onboarding Guide

1. Create a new document: `Onboarding Guide`
2. Body content:
   ```
   ## Welcome to Clossette!

   This guide walks new team members through their first week.

   ### Day 1: Access & Setup
   - [ ] Get Huly workspace access (ask founder)
   - [ ] Set up local dev environment — see Engineering Wiki > Development Setup
   - [ ] Read "About Clossette" document (this Wiki)
   - [ ] Browse Operations Card Space — SOPs and Company Handbook
   - [ ] Set up Git access (repo: Clossette)

   ### Day 2-3: Understand the Product
   - [ ] Read PRD Card in Product Card Space
   - [ ] Run the app locally and explore as a user
   - [ ] Review Architecture Overview in Engineering Card Space
   - [ ] Check your role-specific Cards Space (Engineering/Design/Marketing)

   ### Day 4-5: Start Contributing
   - [ ] Pick up a starter issue in Tracker
   - [ ] Read relevant CLAUDE.md for your module (server/web/worker)
   - [ ] Submit your first PR
   - [ ] Introduce yourself in the team channel

   ### Resources Quick Links
   - Tracker: Active issues and sprint board
   - Cards: Structured knowledge base (PRDs, specs, contracts)
   - Documents: Wiki and free-form guides (you are here)
   ```

### Section 3: Tool Stack

1. Create a new document: `Tool Stack`
2. Body content:
   ```
   ## Tools We Use

   | Tool | Purpose | Access |
   |------|---------|--------|
   | Huly | Project management, knowledge base, docs | All team members |
   | GitHub | Source code, PRs, CI | Engineers |
   | Figma | UI/UX design | Designers + PM |
   | Docker | Local dev + production deployment | Engineers |
   | Stripe | Payment processing | Admin only |
   | Mailpit | Dev email testing | Engineers (local) |
   | Resend | Production transactional email | Admin only |

   For detailed setup instructions, see Engineering Wiki > Development Setup.
   ```

---

## TASK 6: Build Meeting Agendas & Reports Structure

Create initial structure within the Meeting Agendas & Reports teamspace.

### Section 1: Templates Area

1. Navigate to `Meeting Agendas & Reports` teamspace
2. Create a document: `Templates`
3. Body intro:
   ```
   Document templates for recurring meetings and reports.
   Copy a template to create a new instance.
   ```

4. Create child template documents:

   **Template 1: Weekly Status Update**
   - Title: `[Template] Weekly Status Update`
   - Body content:
   ```
   # Weekly Status Update — [Team Name] — [Date]

   ## Highlights
   - (What was accomplished this week?)

   ## In Progress
   - (What is actively being worked on?)

   ## Blockers
   - (What is preventing progress?)

   ## Next Week
   - (What is planned for next week?)

   ## Metrics / KPIs
   - (Any relevant numbers — PRs merged, bugs fixed, content published, etc.)
   ```

   **Template 2: Sprint Retrospective**
   - Title: `[Template] Sprint Retrospective`
   - Body content:
   ```
   # Sprint Retrospective — [Sprint Name] — [Date]

   ## What went well
   -

   ## What could be improved
   -

   ## Action items
   - [ ] (Specific improvement with owner and deadline)

   ## Team mood (1-5)
   ```

   **Template 3: Meeting Agenda**
   - Title: `[Template] Meeting Agenda`
   - Body content:
   ```
   # Meeting Agenda — [Topic] — [Date]

   **Attendees**: (list)
   **Duration**: (30 min / 60 min)
   **Facilitator**: (name)

   ## Agenda Items
   1. [Topic] — [Owner] — [Time]
   2. [Topic] — [Owner] — [Time]
   3. [Topic] — [Owner] — [Time]

   ## Pre-read
   - (Links to relevant Cards or Documents)

   ## Notes
   (To be filled during the meeting)

   ## Action Items
   - [ ] (To be filled during the meeting)
   ```

   **Template 4: Project Kickoff**
   - Title: `[Template] Project Kickoff`
   - Body content:
   ```
   # Project Kickoff — [Project Name]

   ## Objective
   What are we building and why?

   ## Scope
   - In scope:
   - Out of scope:

   ## Team
   | Role | Person |
   |------|--------|
   | Lead | |
   | Designer | |
   | Engineer(s) | |

   ## Timeline
   | Milestone | Target Date |
   |-----------|-------------|
   | Design complete | |
   | MVP ready | |
   | Launch | |

   ## Related Resources
   - PRD Card: (link)
   - Design Asset Card: (link)
   - Tracker Project: (link)

   ## Risks
   -

   ## Success Criteria
   -
   ```

### Section 2: Weekly Reports

1. Create a document: `Weekly Reports`
2. Body intro:
   ```
   Weekly status reports by team. Copy from [Template] Weekly Status Update.
   ```
3. Leave empty — this is a container for future weekly reports.

---

## TASK 7: Create Starter Documents (Verification)

Create one real document in each teamspace to verify the structure works.

### Starter 1: Engineering Wiki — Git Workflow

1. Navigate to `Engineering Wiki` → `Runbooks`
2. Create a new child document: `Git Workflow`
3. Body content:
   ```
   ## Branch Strategy
   - main branch is the primary branch
   - Feature branches: feature/<description>
   - Bug fix branches: fix/<description>

   ## Commit Message Format
   <type>: <description>

   Types: feat, fix, refactor, docs, test, chore, perf, ci

   ## Pull Request Process
   1. Create branch from main
   2. Make changes and commit
   3. Push and create PR via GitHub
   4. PRs sync to Huly Tracker (Clossette project)
   5. Get review and merge

   ## GitHub <> Huly Sync
   - Clossette repo is mapped to Clossette Tracker project
   - PRs appear in Tracker automatically
   - Labels sync between platforms
   ```

### Starter 2: Company Wiki — Team Values

1. Navigate to `Company Wiki`
2. Create a new document: `Team Values`
3. Body content:
   ```
   ## Our Values

   ### User Empathy First
   We build for our users — Gen Z shoppers who are overwhelmed by choice.
   Every feature should reduce decision fatigue, not add to it.

   ### Ship and Learn
   We prefer shipping small increments over perfecting in isolation.
   User feedback > our assumptions.

   ### Inclusive by Default
   Body-positive avatars, size-inclusive design, accessible interfaces.
   Not an afterthought — a core principle.

   ### Indie Over Mass
   We champion independent designers. Our marketplace exists
   to amplify unique voices, not replicate fast fashion.
   ```

### Starter 3: Meeting Agendas & Reports — Sample Weekly Report

1. Navigate to `Meeting Agendas & Reports` → `Weekly Reports`
2. Create a new child document: `2026-06-20 — Engineering Weekly`
3. Body content (copy from Weekly Status template, fill in):
   ```
   # Weekly Status Update — Engineering — 2026-06-20

   ## Highlights
   - Completed Huly knowledge base setup (Phase 1-4B)
   - Cloth size selection feature shipped to cart and checkout

   ## In Progress
   - Documents module setup (Phase 4C)
   - Community feed enhancements

   ## Blockers
   - None

   ## Next Week
   - Complete Documents module setup
   - Begin Phase 5 planning (if applicable)

   ## Metrics
   - Server tests: 48 files, 338 methods
   - Web tests: 17 files, 227 cases
   - E2E tests: 8 specs, 60 tests
   - Worker tests: 15 files, 292 tests
   ```

---

## TASK 8: Verify Documents <> Cards Cross-Linking

Test that Documents can reference Cards and vice versa.

1. Open the `[Draft] AI Outfit Recommendation Improvements` document in Product & Design Wiki
2. Try to insert a link/mention to the PRD Card `PRD: AI-powered outfit recommendations` in the Product Card Space:
   - Type `@` or use any inline mention/link feature
   - Search for the PRD Card
   - If linking works, the mention should be clickable and navigate to the Card
3. Screenshot the result

4. Open the PRD Card `PRD: AI-powered outfit recommendations` in the Product Card Space
5. Try to reference back to the Document:
   - In the Card's description or comments, try to link to the Document
   - If bi-directional linking is available, verify it

6. Report findings:
   - Can Documents mention/link to Cards? (Yes / No / Partial)
   - Can Cards reference Documents? (Yes / No / Partial)
   - Is there any other cross-module integration? (e.g., embed, sidebar panel)

> If cross-linking is not supported, note this limitation. Documents and Cards can still coexist as separate knowledge layers — Documents for drafts/wiki, Cards for structured data.

---

## COMPLETION CHECKLIST

After all tasks, verify and report:

### Document Teamspaces (4)

- [ ] `Company Wiki` — all members visible
- [ ] `Engineering Wiki` — private (engineers)
- [ ] `Product & Design Wiki` — private (PM + designers)
- [ ] `Meeting Agendas & Reports` — all members visible

### Wiki Structure (document hierarchy)

**Company Wiki:**
- [ ] About Clossette
- [ ] Onboarding Guide
- [ ] Tool Stack
- [ ] Team Values

**Engineering Wiki:**
- [ ] Development Setup
  - [ ] Local Environment Setup
  - [ ] Environment Variables Guide
- [ ] Runbooks
  - [ ] Production Deployment Runbook
  - [ ] Database Operations Runbook
  - [ ] Git Workflow
- [ ] Architecture Notes (empty landing page)

**Product & Design Wiki:**
- [ ] Brainstorms
  - [ ] [Draft] AI Outfit Recommendation Improvements
- [ ] User Personas
- [ ] Design Principles

**Meeting Agendas & Reports:**
- [ ] Templates
  - [ ] [Template] Weekly Status Update
  - [ ] [Template] Sprint Retrospective
  - [ ] [Template] Meeting Agenda
  - [ ] [Template] Project Kickoff
- [ ] Weekly Reports
  - [ ] 2026-06-20 — Engineering Weekly

### Cross-Linking Verification

- [ ] Document → Card link tested (result documented)
- [ ] Card → Document link tested (result documented)

### Documents vs Cards Separation (verified)

| Content Type | Lives In | Reason |
|---|---|---|
| Weekly status reports | Documents (Meeting Agendas & Reports) | Free-form, no filtering needed |
| Meeting records with type/date/attendees | Cards (Meeting Note) | Needs structured attributes for filtering |
| PRDs with status tracking | Cards (PRD) | Needs Status, Relations, Business Impact |
| Brainstorm drafts | Documents (Product & Design Wiki) | Temporary, promote to Cards when validated |
| Architecture decisions (formal) | Cards (ADR) | Needs Decision Status, structured review |
| Architecture notes (informal) | Documents (Engineering Wiki) | Free-form technical notes |
| Onboarding checklists (per person) | Cards (Onboarding Checklist) | Needs Role, Status, Due Date tracking |
| Onboarding reading guide (general) | Documents (Company Wiki) | One-time narrative, no per-person tracking |
| SOPs with review cycles | Cards (SOP) | Needs Review Cycle, Next Review date |
| Tool setup guides | Documents (Engineering Wiki) | Free-form how-to, no structured attributes |

## FALLBACK NOTES

If the Documents module UI significantly differs from this guide:

1. **No Teamspace concept**: Create top-level documents as section headers, with child documents beneath them
2. **No nested documents**: Use a flat structure with naming convention prefixes (e.g., `[ENG] Local Setup`, `[COMPANY] Onboarding`)
3. **No template system**: Create regular documents with `[Template]` prefix — users manually copy them
4. **Cannot link to Cards**: Use plain text references like `See PRD Card: "PRD: AI-powered outfit recommendations" in Product Card Space`
5. **Limited permissions**: If Teamspace-level privacy is not available, note the limitation — sensitive content should stay in Cards (Finance, People & Culture Spaces already have access controls)
6. **Documents not available**: If the workspace plan does not include Documents, skip this phase entirely and note that all wiki content can be created as unstructured Cards with minimal attributes in a new "Wiki" Card Space
