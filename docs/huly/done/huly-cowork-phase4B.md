# Huly Phase 4B: Processes Setup — Browser Automation Instructions

> Target: Huly Cloud (app.huly.io), workspace with Phase 1-3 Cards + Phase 4A Tracker completed
> Scope: Processes module — workflow definitions on existing Card Types with states, transitions, and automation
> Prerequisite: Phase 1-3 Cards complete (20+ Types, 8 Spaces) + Phase 4A Tracker complete (Clossette + Design + Marketing projects, 8 Task Types on Classic project)
> Note: Processes is a newer Huly feature with limited official documentation. This guide uses an adaptive approach — screenshot and verify UI before each configuration step.
> Estimated: ~40 browser actions

---

## PRE-FLIGHT CHECK

Before starting, verify the workspace is ready:

1. Navigate to Cards module → confirm 8 Card Spaces exist (+ Default = 9 total)
2. Navigate to Tracker module → confirm 3 active Projects exist: Clossette (CLOSS), Design (DSN), Marketing (MARKE)
3. **Find the Processes module** in the left sidebar (it should appear as a distinct module icon)
4. Click on Processes → take a screenshot of the initial UI
5. If Processes module is NOT visible:
   - Check Settings → look for module visibility toggles
   - Try the bottom of the left sidebar for hidden/disabled modules
   - If still not found, screenshot the left sidebar and ask the user

**IMPORTANT**: Because Processes is a newer feature, the UI may differ from what this guide describes. At each TASK, take a screenshot first, then match the instructions to what you see. If the UI significantly differs, describe what you see and ask the user before proceeding.

---

## TASK 1: Explore Processes Module UI

This is a discovery task. Do NOT create anything yet.

1. Navigate to the Processes module
2. Take a screenshot of the main interface
3. Look for and report:
   - Is there a way to create new Processes/Workflows? (e.g., `+` button, "Create Process")
   - Are there any pre-existing/example processes?
   - Can you see a list of Card Types that processes can attach to?
   - Is there a visual workflow editor (states + transitions diagram)?
   - Are there settings for automation/triggers?
4. Navigate to Settings → look for any Processes-related configuration
5. Take a screenshot of Settings related to Processes
6. Report your findings before proceeding to TASK 2

> Based on your findings, the remaining TASKs describe the expected configuration. Adapt the steps to match the actual UI.

---

## TASK 2: Create "Content Publishing" Process

This process governs Content Piece Cards (Marketing domain) through a publishing workflow.

**Attach to Card Type**: `Content Piece`

### Process States

| State | Category/Type | Description |
|-------|--------------|-------------|
| `Ideation` | Initial/Backlog | Content idea proposed |
| `Drafting` | Active | Content being written/created |
| `Review` | Active | Under editorial review |
| `Approved` | Active | Approved, ready to schedule |
| `Scheduled` | Active | Publication date set |
| `Published` | Done/Complete | Content is live |
| `Cancelled` | Cancelled | Content abandoned |

### Transitions (if configurable)

| From | To | Condition |
|------|----|-----------|
| Ideation | Drafting | Author assigned |
| Drafting | Review | Draft completed |
| Review | Approved | Reviewer approves |
| Review | Drafting | Reviewer requests changes (return) |
| Approved | Scheduled | Publish date set |
| Scheduled | Published | Auto or manual on publish date |
| Any | Cancelled | Manual cancellation |

### Steps to create

1. In the Processes module, click the create/add button (likely `+` or "Create Process")
2. Name: `Content Publishing`
3. Attach to Card Type: `Content Piece` (look for a dropdown or selector to link to a Card Type)
4. Add the 7 states listed above
5. Define transitions between states (if the UI supports transition configuration)
6. Set `Ideation` as the initial/start state
7. Set `Published` and `Cancelled` as terminal/end states
8. Save the process
9. Take a screenshot to verify

---

## TASK 3: Create "Document Approval" Process

This process governs PRDs, ADRs, SOPs, and other documents derived from Base Document through a review-and-approval workflow.

**Attach to Card Type**: `Base Document` (so all derived Types inherit this process)

> If Huly does not allow attaching a process to a parent Type that propagates to derived Types, attach it to `PRD` instead (the most frequently reviewed document type).

### Process States

| State | Category/Type | Description |
|-------|--------------|-------------|
| `Draft` | Initial/Backlog | Document being written |
| `In Review` | Active | Under peer/stakeholder review |
| `Changes Requested` | Active | Reviewer asked for modifications |
| `Approved` | Done/Complete | Document approved and active |
| `Archived` | Done/Complete | Document retired |

### Transitions

| From | To | Condition |
|------|----|-----------|
| Draft | In Review | Author submits for review |
| In Review | Approved | Reviewer approves |
| In Review | Changes Requested | Reviewer requests changes |
| Changes Requested | In Review | Author resubmits |
| Approved | Archived | Document superseded or retired |

### Steps to create

1. Create a new Process
2. Name: `Document Approval`
3. Attach to Card Type: `Base Document` (or `PRD` if parent-level attachment is not supported)
4. Add the 5 states listed above
5. Define transitions
6. Save and screenshot

---

## TASK 4: Create "Contract Lifecycle" Process

This process governs Contract Cards (Finance domain) through their lifecycle.

**Attach to Card Type**: `Contract`

### Process States

| State | Category/Type | Description |
|-------|--------------|-------------|
| `Drafted` | Initial/Backlog | Contract being drafted |
| `Under Review` | Active | Legal/financial review |
| `Negotiation` | Active | Terms being negotiated |
| `Signed` | Active | Contract executed |
| `Active` | Active | Contract in effect |
| `Expiring` | Active | Within 30 days of end date |
| `Expired` | Done/Complete | Contract ended |
| `Terminated` | Cancelled | Contract terminated early |

### Transitions

| From | To | Condition |
|------|----|-----------|
| Drafted | Under Review | Submitted for review |
| Under Review | Negotiation | Changes needed |
| Under Review | Signed | Approved as-is |
| Negotiation | Under Review | Resubmitted |
| Signed | Active | Effective date reached |
| Active | Expiring | Approaching end date |
| Expiring | Active | Renewed |
| Expiring | Expired | End date passed |
| Any | Terminated | Manual termination |

### Steps to create

1. Create a new Process
2. Name: `Contract Lifecycle`
3. Attach to Card Type: `Contract`
4. Add the 8 states
5. Define transitions
6. Save and screenshot

---

## TASK 5: Create "Onboarding" Process

This process governs Onboarding Checklist Cards (People & Culture domain).

**Attach to Card Type**: `Onboarding Checklist`

### Process States

| State | Category/Type | Description |
|-------|--------------|-------------|
| `Not Started` | Initial/Backlog | New hire not yet started |
| `Week 1` | Active | First week orientation |
| `Week 2-4` | Active | First month ramp-up |
| `Probation` | Active | Probation period |
| `Completed` | Done/Complete | Onboarding finished |

### Transitions

| From | To | Condition |
|------|----|-----------|
| Not Started | Week 1 | Start date reached |
| Week 1 | Week 2-4 | Week 1 checklist complete |
| Week 2-4 | Probation | First month complete |
| Probation | Completed | Manager confirms |

### Steps to create

1. Create a new Process
2. Name: `Onboarding`
3. Attach to Card Type: `Onboarding Checklist`
4. Add the 5 states
5. Define transitions
6. Save and screenshot

---

## TASK 6: Create "Campaign Lifecycle" Process

This process governs Campaign Plan Cards (Marketing domain).

**Attach to Card Type**: `Campaign Plan`

### Process States

| State | Category/Type | Description |
|-------|--------------|-------------|
| `Planning` | Initial/Backlog | Campaign being planned |
| `Content Creation` | Active | Assets and content in production |
| `Ready` | Active | All assets ready, awaiting launch |
| `Active` | Active | Campaign running |
| `Paused` | Active | Campaign temporarily paused |
| `Completed` | Done/Complete | Campaign ended |
| `Cancelled` | Cancelled | Campaign abandoned |

### Transitions

| From | To | Condition |
|------|----|-----------|
| Planning | Content Creation | Brief approved |
| Content Creation | Ready | All content pieces completed |
| Ready | Active | Launch date reached |
| Active | Paused | Manual pause |
| Paused | Active | Resume |
| Active | Completed | End date reached |
| Any | Cancelled | Manual cancellation |

### Steps to create

1. Create a new Process
2. Name: `Campaign Lifecycle`
3. Attach to Card Type: `Campaign Plan`
4. Add the 7 states
5. Define transitions
6. Save and screenshot

---

## TASK 7: Verify Process Execution on Existing Cards

Test each process by starting a workflow execution on an existing Card.

### Test 1: Content Publishing

1. Navigate to Cards → Marketing space → Content Piece cards
2. Open any existing Content Piece card (or create one: title `[Test] Process verification`)
3. Look for a way to start/attach a Process execution on this card (may be a button like "Start Process", "Run Workflow", or in the card's side panel)
4. Select the `Content Publishing` process
5. Verify the card now shows process state (should start at `Ideation`)
6. Try advancing the state to `Drafting`
7. Screenshot the card showing the active process state

### Test 2: Document Approval

1. Navigate to Cards → Product space → PRD cards
2. Open an existing PRD card
3. Start the `Document Approval` process
4. Verify it starts at `Draft`
5. Try advancing to `In Review`
6. Screenshot

### Test 3: Contract Lifecycle

1. Navigate to Cards → Finance space → Contract cards
2. Open an existing Contract card
3. Start the `Contract Lifecycle` process
4. Verify it starts at `Drafted`
5. Screenshot

### Test 4: Campaign Lifecycle

1. Navigate to Cards → Marketing space → Campaign Plan cards
2. Open an existing Campaign card
3. Start the `Campaign Lifecycle` process
4. Verify it starts at `Planning`
5. Screenshot

> If any process cannot be started on a card, screenshot the UI and describe what options are available. The process-to-card attachment mechanism may vary.

---

## TASK 8: Create Saved Views for Process States (if supported)

If the Cards module supports filtering by Process state, create these Saved Views:

### In Marketing Space

1. **"Content: Awaiting Review"** — Content Piece cards where process state = `Review`
2. **"Campaigns: Active"** — Campaign Plan cards where process state = `Active`

### In Product Space

3. **"PRDs: In Review"** — PRD cards where process state = `In Review`

### In Finance Space

4. **"Contracts: Expiring"** — Contract cards where process state = `Expiring`

For each:
1. Navigate to the Space → apply Filter by process state
2. Click "Save as" → enter view name → set as Public
3. Verify it appears in the sidebar

> If filtering by process state is not available in the Cards module, skip this TASK and note it for the user.

---

## COMPLETION CHECKLIST

After all tasks, verify and report:

- [ ] Processes module is accessible and functional
- [ ] 5 Processes created:
  - [ ] Content Publishing (attached to Content Piece, 7 states)
  - [ ] Document Approval (attached to Base Document or PRD, 5 states)
  - [ ] Contract Lifecycle (attached to Contract, 8 states)
  - [ ] Onboarding (attached to Onboarding Checklist, 5 states)
  - [ ] Campaign Lifecycle (attached to Campaign Plan, 7 states)
- [ ] Process execution verified on at least 2 existing Cards
- [ ] Saved Views for process states created (if supported)
- [ ] Screenshots captured for each Process definition and execution test

## FALLBACK NOTES

If the Processes module UI significantly differs from this guide:

1. **No visual workflow editor**: Create states as a linear list, document transitions in the process description/notes
2. **Cannot attach to Card Types**: Processes may need to be started manually on individual Cards rather than auto-attached to a Type
3. **Limited state configuration**: Use whatever state/status mechanism is available, even if simpler than described
4. **Process not startable on Cards**: The feature may require additional setup — check Settings → Processes for configuration options
5. **Only some features available**: Complete what is possible, skip what is not, and report the gaps to the user
