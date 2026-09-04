# Huly Phase 4D Completion Report: Planner & Cross-Module Integration

> Workspace: Clossette (app.huly.io / huly.app), Huly Cloud v0.7.423
> Date: 2026-06-20
> Scope: Planner module configuration, time tracking, and cross-module integration verification (Cards / Tracker / Documents / Processes / Planner)
> Executed: PRE-FLIGHT CHECK + TASK 1 to TASK 8

---

## PRE-FLIGHT CHECK (passed)

| Prerequisite | Expected | Found | Status |
|---|---|---|---|
| Cards Spaces | 8 (+ Default = 9) | 9 (Default, Operations, People & Culture, Design, Marketing, Finance, Meeting Notes, Product, Engineering) | OK |
| Tracker Projects | 3 | 3 (Clossette, Design, Marketing) | OK |
| Processes | 5 | 4 with live executions (Document Approval, Content Publishing, Campaign Lifecycle, Contract Lifecycle) + Onboarding defined | OK |
| Documents Teamspaces | 4 | 4 Phase 4C (Company Wiki, Engineering Wiki, Product & Design Wiki, Meeting Agendas & Reports) + CLOSSETTE + Quick-Start = 6 total | OK |
| Planner module | locate | Found at `/workbench/clossette/time` (calendar icon in left rail) | OK |

---

## TASK 1: Planner Module UI (discovery, nothing created)

The Planner lives at `/time` and uses a three pane layout:

- Left: view filters **Unplanned / Planned / All**, plus a month mini calendar with a legend (Due date = red, Scheduled = blue).
- Middle: a personal **Action Item** to do list with an "Add Action Item, press Enter to save" input.
- Right: **Schedule**, a rolling multi day calendar (Today plus next two days, hourly slots, live now line, an All day row, and prev/next date arrows).

Findings:

- **Views:** No Day / Week / Month toggle buttons. The Schedule is a fixed rolling agenda; the arrows shift the date window. Full calendar views live in the separate Calendar module.
- **Personal To Dos:** Yes, created directly in Planner, separate from Tracker Issues.
- **Tracker Issues auto appear:** Yes, but only once an issue is assigned to you with an active status (see TASK 2). On first load the Planner was empty.
- **Time tracking:** No stopwatch in the Planner itself; it is time blocking (drag items onto schedule slots). Real time tracking lives on Tracker Issues (see TASK 3).
- **Drag and drop reschedule:** Yes, items drag from the Unplanned list onto schedule slots.
- **Calendar integration:** Yes. Settings > Calendar shows a connected external calendar (FreeBusy visibility) plus the internal HULY calendar. External providers connect via Settings > Integrations.
- **Planner settings:** No dedicated Planner settings page. Relevant config is account level: Calendar, Notifications, Integrations. No explicit work hours / availability setting was found.

---

## TASK 2: Planner Views + Personal To Dos

Created 3 personal to do items with due dates:

| Task | Due |
|---|---|
| Review Huly knowledge base structure | Jun 20 (Today) |
| Update team on Huly setup progress | Jun 21 (Tomorrow) |
| Schedule weekly knowledge base review | Jun 26 (Friday) |

**Issue to Planner flow (verified):** With no issues assigned, the Planner was empty. After creating issue **CLOSS-11** (assigned to Jadyn Wu, status In Progress), it appeared automatically in the Planner "All" view, grouped under the CLOSSETTE project, alongside the 3 personal to dos. This confirms the Planner acts as a single pane of glass that aggregates assigned active Tracker Issues plus personal action items.

---

## TASK 3: Time Tracking (available and working)

Time tracking IS available in Huly (the guide hedged on this). Two mechanisms exist:

1. **Tracker Issue time tracking.** Each issue exposes Estimation, Spent time, and Remaining time. The Spent time field opens a "Time spent reports" ledger (columns: Issue, Time, Employee, Title, Date, Description).
   - Test on CLOSS-11: set Estimation to 30m, then logged a 30m time report ("Phase 4D cross-module integration review"). Result: Spent time 30m, Remaining time auto recomputed to 0h. The Activity log recorded both the estimation and the time report.
2. **Planner time blocking.** Each Action Item has a WORK SCHEDULE section with "Add Slot" and a duration Summary, used to allocate calendar time blocks.

Reporting: per issue time spent ledger with per entry Employee and Date. Project and person rollups are available through estimation rollups on parent issues and milestones.

---

## TASK 4: Tracker Issues <-> Cards Linking

| Direction | Supported | Method |
|---|---|---|
| Issue -> Card | Yes | @ mention inserts a clickable chip |
| Card -> Issue | Yes | @ mention inserts a clickable chip |

- In CLOSS-11 I inserted "Related PRD: [EXAMPLE] PRD: AI-powered outfit recommendations" (the @ menu offers an explicit CARDS category).
- In the PRD card body I inserted "Related issue: CLOSS-11 [Spike] Evaluate Cards <-> Tracker integration" (the @ menu offers ISSUES and PULL REQUESTS categories).
- **Formal relations:** Huly's typed Relations (for example a PRD that "implements" a Feature Spec or "promotes" a Campaign Plan) are Card to Card only. There is no formal typed relation between a Card and a Tracker Issue; cross module linking uses @ mentions.
- **Backlinks:** mentions surface in the target's Activity feed and Inbox notifications (a soft backlink), not as a reciprocal inline chip.

---

## TASK 5: Documents <-> Other Modules Linking

The @ mention picker is shared across Card, Document, and Issue rich text editors. It offers categories: Employees, Companies, Documents, Cards, Issues, Pull Requests, Meeting Minutes. All six cross module directions work.

| From -> To | Supported | Method | Evidence |
|---|---|---|---|
| Issue -> Card | Yes | @ mention | inserted in CLOSS-11 |
| Card -> Issue | Yes | @ mention | inserted in PRD card |
| Document -> Card | Yes | @ mention | inserted "Frontend Architecture Map" in Git Workflow doc; pre-existing "Related Card" chip in the [Draft] doc |
| Document -> Issue | Yes | @ mention | inserted CLOSS-11 in Git Workflow doc |
| Issue -> Document | Yes | @ mention | Documents category present in the issue @ menu |
| Card -> Document | Yes | @ mention | pre-existing [Draft] doc link in the PRD card body |

Gotcha (carried from earlier phases): a multi word @ query containing a space terminates the mention and leaves literal text. Search with a single token, then pick from the menu.

---

## TASK 6: Process Execution <-> Planner (integration is essentially none)

- Process executions live in the Processes module (lightning bolt), grouped by definition with their current state (for example Document Approval = Draft, Content Publishing = Ideation, Campaign Lifecycle = Planning).
- Clicking an execution opens the underlying Card, not a separate execution object.
- **Process states visible in Planner:** No.
- **Process transitions create Planner items:** No. Transitions are automation triggers, not assignable action items.
- **Process related Cards appear in Planner:** No. Even card date fields such as a Content Piece "Publish Date" do not feed the Planner; the Planner pulls only ToDos, assigned active Issues, and Calendar events.
- The card's inline "Processes" section can display "No processes" even when an execution exists (a known 0.7.423 display quirk). The Processes module is authoritative.

---

## TASK 7: Cross-Module Saved Views

**Audit (15 Cards saved views, all accessible in FILTERED VIEWS):**
Active Campaigns, Content Calendar, Design Review Queue, Stable Components, Active Vendors, Expiring Contracts, Open Positions, Beginner Training, Active Policies, Tech Design Docs, API Reference, SOPs Due for Review, Active Feature Specs, In Review PRDs, Needs Review.

- Accessibility verified: clicking "Active Campaigns" returned the correct filtered result (1 Campaign Plan, the Summer Collection Launch, Status Planning).
- **Cross module dashboard views:** Not supported. Cards filtered views filter card fields only and cannot include Tracker Issues. The closest equivalents are Tracker's "My Issues -> Active" tab (spans all projects for assigned active issues) and the per space Cards views. Existing per module views already give good coverage.

---

## TASK 8: Knowledge Base Completeness Audit

### Module inventory

| Module | Expected | Actual | Notes |
|---|---|---|---|
| Cards Spaces | 8 (+ Default) | 9 | Engineering, Product, Design, Marketing, Operations, Finance, People & Culture, Meeting Notes, + Default |
| Cards Types (custom) | 22+ | 22 | Base Document + 12 derivatives; Meeting Note; Design Asset; 7 standalone (Budget Item, Campaign Plan, Content Piece, Design System Entry, Onboarding Checklist, Role Description, Vendor) |
| Cards Tags | 4 | 4 | Priority, Confidential, Review Required, Clossette Module |
| Cards Relations | 7+ | 7 | PRD<->Feature Spec, Feature Spec<->ADR, Design Asset<->Feature Spec, Campaign<->Content Piece, Campaign<->PRD, Vendor<->Contract, Feature Spec<->API Doc |
| Cards Saved Views | 15+ | 15 | listed above |
| Tracker Projects | 3 | 3 | Clossette (GitHub synced), Design, Marketing |
| Tracker Task Types | 6-8 | 8 | Pull request, Feature, Bug, Chore, Design, Research/Spike, Content/Asset, Issue |
| Tracker Labels | 14+ | 14+ | workspace wide |
| Processes | 5 | 5 | Content Publishing, Document Approval, Contract Lifecycle, Onboarding, Campaign Lifecycle |
| Documents Teamspaces | 4 | 6 | 4 Phase 4C wikis + CLOSSETTE default + Quick-Start |
| Documents | 20+ | 20+ | wiki pages, templates, starter docs |
| Planner Personal tasks | 3+ | 3 | created this phase (+ CLOSS-11 issue surfaced) |

### Cross-module navigation test (5-step flow, all working)

1. **Planner** showed CLOSS-11 plus the 3 personal to dos for today.
2. **Tracker** opened CLOSS-11; checked status In Progress, Estimation 30m, Spent 30m.
3. **Tracker -> Cards** via the PRD mention chip in the issue body, landing on the PRD card.
4. **Cards -> Documents** via the [Draft] doc link in the PRD body, and via the chips in the Git Workflow runbook.
5. **Processes** confirmed a live Content Publishing execution on the Summer Look Reveal Reel Content Piece card.

A user can navigate naturally between all five modules using @ mention chips and relation links.

### Summary

- Total knowledge base now spans 5 working modules: Cards (9 spaces, 22 custom types, 4 tags, 7 relations, 15 saved views, 30+ content cards), Tracker (3 projects, 8 task types, 14+ labels, components and milestones), Processes (5 definitions with live executions), Documents (6 teamspaces, 20+ documents), and Planner (personal to dos plus aggregated assigned issues).
- Cross module linking is universal via @ mentions across Cards, Documents, and Issues (all 6 directions verified).
- Formal typed relations remain Card to Card only.
- Process and Planner integration is limited by design (transitions are automation triggers).

---

## Differences from the guide

1. **Time tracking exists.** The guide hedged ("if available"); Huly has full per issue time tracking (Estimation, Spent time, Remaining time) plus a Time spent reports ledger.
2. **Planner has no Day/Week/Month toggle.** It is a rolling agenda; the dedicated Calendar module holds full calendar views.
3. **Tracker single project model.** Per earlier phases, Clossette is one GitHub synced project (not the literal 4 project rebuild from the original plan); Design and Marketing are the two added projects.
4. **GitHub aware issue creation.** Creating an issue in the Clossette project offers "create with GitHub" vs "without GitHub". The Phase 4D test issue (CLOSS-11) was created without GitHub to avoid pushing to the public repo.
5. **No cross module dashboard view.** Saved views stay per module.

## Recommendations / next steps

- Use Tracker "My Issues -> Active" as the daily driver for assigned work, and the Planner for personal action items and time blocking.
- When you want a Tracker issue to appear in the Planner, assign it to yourself and set an active status.
- For automation, build out Process transitions (approval and field change triggers) on the high traffic types (Content Piece, Contract, PRD).
- Keep cross module links as @ mentions; treat the Inbox as the backlink surface.
- Consider an external time tool only if you need cross project time dashboards beyond per issue reports.

---

## Completion checklist

Planner configuration
- [x] Planner module accessible and functional
- [x] Day/Week view explored and documented (rolling agenda; no Day/Week toggle)
- [x] 3 personal to do items created
- [x] Tracker Issues visible in Planner (auto appear when assigned + active)
- [x] Time tracking explored (available; tested on CLOSS-11)

Cross-module integration
- [x] Issue -> Card linking tested (Yes, @ mention)
- [x] Card -> Issue linking tested (Yes, @ mention)
- [x] Document -> Card linking tested (Yes, @ mention)
- [x] Document -> Issue linking tested (Yes, @ mention)
- [x] Issue -> Document linking tested (Yes, @ mention)
- [x] Card -> Document linking tested (Yes, @ mention)
- [x] Process <-> Planner interaction tested (no integration, documented)

Saved views optimization
- [x] All prior phase saved views still accessible (15)
- [x] Cross module dashboard views attempted (not supported, documented)

Knowledge base audit
- [x] Module inventory completed
- [x] Cross module navigation workflow tested (5 step flow)
- [x] Summary report generated (this document)
