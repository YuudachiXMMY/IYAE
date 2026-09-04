# Huly Phase 4D: Planner & Cross-Module Integration — Browser Automation Instructions

> Target: Huly Cloud (app.huly.io), workspace with Phase 1-3 Cards + Phase 4A Tracker + Phase 4B Processes + Phase 4C Documents completed
> Scope: Planner module configuration + time tracking + cross-module integration verification (Cards ↔ Tracker ↔ Documents ↔ Processes ↔ Planner)
> Prerequisite: Phase 1-3 Cards (20+ Types, 8 Spaces) + Phase 4A Tracker (3 Projects, Issues) + Phase 4B Processes (5 Processes) + Phase 4C Documents (4 Teamspaces)
> Purpose: This is the "closing" phase — configure the personal productivity layer (Planner) and verify all 5 modules work together as an integrated knowledge base
> Note: Planner is a core Huly module for personal task management. UI may vary across versions. This guide uses an adaptive approach.
> Estimated: ~35 browser actions

---

## PRE-FLIGHT CHECK

Before starting, verify the workspace is ready:

1. Navigate to Cards module → confirm 8 Card Spaces exist (+ Default = 9 total)
2. Navigate to Tracker module → confirm 3 active Projects exist: Clossette (CLOSS), Design (DSN), Marketing (MARKE)
3. Navigate to Processes module (⚡) → confirm 5 Processes exist (Content Publishing, Document Approval, Contract Lifecycle, Onboarding, Campaign Lifecycle)
4. Navigate to Documents module → confirm 4 Teamspaces exist: Company Wiki, Engineering Wiki, Product & Design Wiki, Meeting Agendas & Reports
5. **Find the Planner module** in the left sidebar (typically a calendar or checkbox icon, may also be labeled "My Work" or "Planner")
6. Click on Planner → take a screenshot of the initial UI

If Planner is NOT visible:
- Check the left sidebar for any personal productivity section
- Look in Settings for module toggles
- If still not found, screenshot the left sidebar and ask the user

**IMPORTANT**: At each TASK, take a screenshot first, then match the instructions to what you see.

---

## TASK 1: Explore Planner Module UI

This is a discovery task. Do NOT change any settings yet.

1. Navigate to the Planner module
2. Take a screenshot of the main interface
3. Look for and report:
   - What views are available? (Day / Week / Month / Agenda / List?)
   - Are Tracker Issues automatically visible in Planner? (Check if any existing Issues from Phase 4A appear)
   - Is there a "To Do" or personal task section separate from Tracker Issues?
   - Can you create personal tasks directly in Planner?
   - Is there a time tracking feature? (timer button, time entries, duration fields)
   - Can you drag-and-drop items to reschedule?
   - Is there integration with calendar events?
4. Check for Planner-related settings:
   - Navigate to Settings → look for Planner configuration
   - Check if there are notification preferences for due dates
   - Check if there are work hours / availability settings
5. Take screenshots of all relevant sections
6. Report your findings before proceeding to TASK 2

> Based on your findings, the remaining TASKs describe the expected configuration. Adapt the steps to match the actual UI.

---

## TASK 2: Configure Planner Views

Set up the Planner for daily and weekly personal productivity.

### Step 2.1: Explore Default View

1. Open Planner → observe the default layout
2. If a Day view exists, switch to it and screenshot
3. If a Week view exists, switch to it and screenshot
4. Note which Tracker Issues appear automatically (they should appear when assigned to you with active status)

### Step 2.2: Create Personal To-Do Items

If Planner supports personal tasks (separate from Tracker Issues):

1. Click `+` or "Add task" in Planner
2. Create 3 personal to-do items:

   | Task | Due | Notes |
   |------|-----|-------|
   | `Review Huly knowledge base structure` | Today | Cross-check all modules are set up correctly |
   | `Update team on Huly setup progress` | Tomorrow | Share Phase 4D completion status |
   | `Schedule weekly knowledge base review` | This Friday | Set up recurring Cards review cadence |

3. Verify they appear in the Planner timeline

### Step 2.3: Verify Issue-to-Planner Flow

1. Navigate to Tracker → Clossette project
2. Find or create an Issue assigned to yourself with an active status (e.g., `In Progress`)
3. Return to Planner → verify the Issue appears in your daily/weekly view
4. If Issues do NOT auto-appear, look for:
   - A way to manually add Tracker Issues to Planner
   - Filter settings that control which Issues show
   - A "My Issues" or "Assigned to me" filter
5. Screenshot the Planner showing both personal tasks and Tracker Issues together

> Key insight: Planner should serve as the "single pane of glass" for daily work — aggregating Tracker Issues + personal to-dos + calendar events.

---

## TASK 3: Time Tracking Configuration

If Huly supports time tracking, configure it for the workspace.

### Step 3.1: Locate Time Tracking

1. Look for time tracking in these locations:
   - Planner module → timer icon or "Time" tab
   - Tracker → Individual Issue → time/duration field
   - Settings → Time Tracking configuration
   - User menu → "My Time" or similar
2. Screenshot what you find

### Step 3.2: Configure Time Tracking (if available)

If time tracking exists:

1. **Enable time tracking** if it requires activation
2. **Test on an existing Issue**:
   - Open a Tracker Issue (e.g., one of the verification Issues from Phase 4A)
   - Start the timer or log a time entry manually
   - Log `0.5h` or `30m` as a test entry
   - Verify the time entry appears on the Issue
3. **Check reporting**:
   - Look for time reports or summaries
   - Check if time can be viewed per-project or per-person
4. Screenshot the time tracking UI and any reports

### Step 3.3: If Time Tracking is NOT Available

If Huly does not have built-in time tracking:
1. Note the finding
2. Skip to TASK 4
3. Time tracking can be handled by external tools (Toggl, Clockify) or added when Huly releases the feature

---

## TASK 4: Tracker Issues ↔ Cards Cross-Module Linking

Verify that Tracker Issues can reference Cards and vice versa.

### Test 1: Issue → Card Link

1. Navigate to Tracker → Clossette project
2. Open an existing Issue (or create one: `[Spike] Evaluate Cards ↔ Tracker integration`)
3. In the Issue description, try to link to a Card:
   - Type `@` or use mention/link features
   - Search for `PRD: AI-powered outfit recommendations` (a Card in Product Space)
   - If mention works, the Card should be clickable from the Issue
4. Screenshot the result

### Test 2: Card → Issue Link

1. Navigate to Cards → Product Space → open the PRD Card `PRD: AI-powered outfit recommendations`
2. In the Card's description or comments, try to link to a Tracker Issue:
   - Type `@` or use mention/link features
   - Search for an existing Issue (e.g., `[Feature] Add avatar pose presets API endpoint`)
   - If linking works, the Issue should be clickable from the Card
3. Screenshot the result

### Test 3: Relation-Based Linking (if available)

1. Check if Cards have a "Related Issues" section or if Tracker Issues have a "Related Cards" section
2. If such a feature exists, try creating a formal relation between:
   - Card: `PRD: AI-powered outfit recommendations` (Product Space)
   - Issue: any Feature Issue in Clossette project
3. Document the linking mechanism

### Report

Document findings:
- Can Issues mention Cards? (Yes / No / Partial)
- Can Cards mention Issues? (Yes / No / Partial)
- Is there formal relation support between modules? (Yes / No)
- Are mentions bi-directional (backlinks)? (Yes / No)

---

## TASK 5: Documents ↔ Other Modules Cross-Linking

Extend the cross-linking verification from Phase 4C TASK 8.

### Test 1: Document → Tracker Issue

1. Navigate to Documents → Engineering Wiki → Runbooks → `Git Workflow`
2. In the document body, try to mention a Tracker Issue:
   - Type `@` and search for an Issue
   - Or try pasting a Huly Issue URL
3. Screenshot the result

### Test 2: Document → Card

1. In the same document or another document, try to mention a Card:
   - Type `@` and search for `Architecture Overview` (Tech Design Doc Card)
3. Screenshot the result

### Test 3: Tracker Issue → Document

1. Navigate to Tracker → open any Issue
2. In the Issue description, try to link to a Document:
   - Type `@` and search for `Local Environment Setup` (Engineering Wiki document)
3. Screenshot the result

### Summary Table

Fill in based on your findings:

| From → To | Supported? | Method |
|-----------|------------|--------|
| Issue → Card | ? | @ mention / URL / relation |
| Card → Issue | ? | @ mention / URL / relation |
| Document → Card | ? | @ mention / URL |
| Document → Issue | ? | @ mention / URL |
| Issue → Document | ? | @ mention / URL |
| Card → Document | ? | @ mention / URL |

---

## TASK 6: Process Execution ↔ Planner Verification

Check if Process executions interact with Planner.

### Test 1: Process State Visibility in Planner

1. Navigate to Processes module (⚡)
2. Find an existing execution (from Phase 4B verification — e.g., Content Publishing on a Content Piece card)
3. Check if the current Process state is visible anywhere in Planner
4. Screenshot Planner to show whether Process-related items appear

### Test 2: Action Items from Processes

1. Check if Process transitions create action items or to-dos in Planner
2. Check if Process states trigger any notifications or Planner entries
3. Document findings

### Expected Result

Based on Phase 4B findings (transitions are automation triggers, not manual), Process ↔ Planner integration is likely limited. Document whatever exists:
- Process states are visible in Planner: Yes / No
- Process transitions create Planner items: Yes / No
- Process-related Cards appear in Planner: Yes / No (if Cards have due dates)

---

## TASK 7: Cross-Module Saved Views Optimization

Review and optimize Saved Views across all modules to create a cohesive workspace.

### Step 7.1: Audit Existing Saved Views

1. Navigate to Cards module
2. List all existing Saved Views (from Phase 2A, 2B, 3):
   - Marketing: Active Campaigns, Content Calendar
   - Design: Design Review Queue, Stable Components
   - Finance: Active Vendors, Expiring Contracts
   - People & Culture: Open Positions, Beginner Training
   - Operations: Active Policies
   - Engineering: Active Feature Specs, Tech Design Docs, API Reference
   - Product: In Review PRDs
   - Cross-type: Needs Review, SOPs Due for Review
3. Take a screenshot of the Saved Views sidebar

### Step 7.2: Create Cross-Module Dashboard Views (if supported)

If Huly supports dashboard-style views or global views that span modules:

1. **My Active Work** — try to create a view showing:
   - Cards where Owner = you AND Status = Active/In Progress
   - Tracker Issues assigned to you AND Status = Active
   - If a single view can span both Cards and Tracker, create it
   - If not, note the limitation

2. **Due This Week** — try to create a view showing:
   - Cards with any date field in the next 7 days
   - Tracker Issues with due date in the next 7 days
   - If possible, combine into one view

### Step 7.3: Verify View Accessibility

1. Confirm all Saved Views from prior phases still exist and are accessible
2. Check if Saved Views appear in a sidebar, bookmark bar, or dedicated section
3. Test one view by clicking it and verifying the filter produces correct results
4. Screenshot the complete Saved Views list

---

## TASK 8: Knowledge Base Completeness Audit

Final verification that all 5 modules work together as an integrated knowledge base.

### Step 8.1: Module Inventory

Navigate to each module and count the items:

| Module | Expected | Actual | Notes |
|--------|----------|--------|-------|
| **Cards** — Spaces | 8 (+ Default) | ? | Engineering, Product, Design, Marketing, Operations, Finance, People & Culture, Meeting Notes |
| **Cards** — Types | 22+ | ? | Base Document + derivatives + standalone types |
| **Cards** — Tags | 4 | ? | Priority, Confidential, Review Required, Clossette Module |
| **Cards** — Relations | 7+ | ? | PRD↔FeatureSpec, FeatureSpec↔ADR, Campaign↔Content, etc. |
| **Cards** — Saved Views | 15+ | ? | Per-space + global views |
| **Tracker** — Projects | 3 | ? | Clossette, Design, Marketing |
| **Tracker** — Labels | 14+ | ? | Workspace-wide labels |
| **Processes** — Definitions | 5 | ? | Content Publishing, Document Approval, etc. |
| **Documents** — Teamspaces | 4 | ? | Company Wiki, Engineering Wiki, etc. |
| **Documents** — Documents | 20+ | ? | Wiki pages, templates, starter docs |
| **Planner** — Personal tasks | 3+ | ? | Created in TASK 2 |

### Step 8.2: Cross-Module Navigation Test

Perform a realistic workflow that touches all 5 modules:

1. **Start in Planner** → find a task or Issue for today
2. **Go to Tracker** → open the related Issue, check its status and labels
3. **From Tracker, go to Cards** → follow a mention/link to a related Card (e.g., PRD)
4. **From Cards, go to Documents** → navigate to a related wiki document (e.g., Engineering Wiki)
5. **Check Processes** → verify if any Process execution is running on the Card
6. Return to Planner

Screenshot each step. The goal is to verify a user can naturally navigate between modules.

### Step 8.3: Generate Summary Report

Create a summary noting:
- Total items created across all phases (Spaces, Types, Cards, Issues, Documents, Processes)
- Cross-module linking capability (what works, what doesn't)
- Key differences from the guide (per Phase 4A and 4B completion reports)
- Recommendations for next steps (automation, advanced workflows)

---

## COMPLETION CHECKLIST

After all tasks, verify and report:

### Planner Configuration

- [ ] Planner module accessible and functional
- [ ] Day/Week view explored and documented
- [ ] 3 personal to-do items created
- [ ] Tracker Issues visible in Planner (or limitation documented)
- [ ] Time tracking explored (available/not available documented)

### Cross-Module Integration

- [ ] Tracker Issue → Card linking tested (result documented)
- [ ] Card → Tracker Issue linking tested (result documented)
- [ ] Document → Card linking tested (result documented)
- [ ] Document → Tracker Issue linking tested (result documented)
- [ ] Issue → Document linking tested (result documented)
- [ ] Card → Document linking tested (result documented)
- [ ] Process ↔ Planner interaction tested (result documented)

### Saved Views Optimization

- [ ] All prior-phase Saved Views still accessible
- [ ] Cross-module dashboard views attempted (result documented)

### Knowledge Base Audit

- [ ] Module inventory completed (counts match expected)
- [ ] Cross-module navigation workflow tested (5-step flow)
- [ ] Summary report generated

### Full Knowledge Base Summary (all Phases complete)

| Module | Items |
|--------|-------|
| Cards — Spaces | 8 (+ Default) |
| Cards — Types | 22+ |
| Cards — Tags | 4 |
| Cards — Relations | 7+ |
| Cards — Saved Views | 15+ |
| Cards — Content Cards | 30+ |
| Tracker — Projects | 3 |
| Tracker — Task Types | 6-8 |
| Tracker — Labels | 14+ |
| Tracker — Components | 13+ |
| Tracker — Milestones | 10+ |
| Processes — Definitions | 5 |
| Documents — Teamspaces | 4 |
| Documents — Documents | 20+ |
| Planner — Personal tasks | 3+ |

## FALLBACK NOTES

If the Planner module UI significantly differs from this guide:

1. **No Planner module**: Huly may have a different personal productivity feature — check "My Work", "Dashboard", or "Home" sections
2. **No personal tasks**: If Planner only shows Tracker Issues, skip personal to-do creation and note the limitation
3. **No time tracking**: Skip TASK 3 entirely — this is a "nice to have" feature
4. **No cross-module mentions**: If `@` mentions don't work across modules, use plain URL links or text references. Document which directions work and which don't
5. **Limited Saved Views**: If dashboard views spanning multiple modules are not supported, keep existing per-module views — they already provide good coverage
6. **Planner not showing Issues**: Check if Issues need to be assigned to you AND have an active status to appear. Try changing an Issue's assignee and status to test
