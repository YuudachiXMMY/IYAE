# Huly Phase 4E: Tracker Templates & Operations Project — Browser Automation Instructions

> Target: Huly Cloud (app.huly.io), workspace with Phase 4A Tracker completed
> Scope: Add Issue Templates to all existing projects + create new Operations Tracker project with templates
> Prerequisite: Phase 4A Tracker (3 Projects: Clossette/CLOSS, Design/DSN, Marketing/MARKE with 3 existing templates in Clossette)
> Estimated: ~40 browser actions

---

## PRE-FLIGHT CHECK

Before starting, verify the workspace is ready:

1. Navigate to Tracker module → confirm 3 active Projects: Clossette (CLOSS), Design (DSN), Marketing (MARKE)
2. Navigate to Clossette project → Templates → confirm 3 existing templates: [Bug], [Feature], [Design]
3. Confirm NO Operations project exists yet in Tracker
4. Navigate to Cards module → confirm Operations Space exists (with SOP, Policy, Company Handbook Entry types)

If anything is missing, complete prior phases first.

---

## TASK 1: Create Operations Tracker Project

### Step 1.1: Create the Project

1. Navigate to Tracker module
2. Click `+` to create a new project
3. Configure:
   - **Project Type**: Classic project (same as existing projects)
   - **Title**: `Operations`
   - **Identifier**: `OPS`
   - **Description**: `Company operations — SOPs, compliance, incidents, vendor management, internal processes`
   - **Default Status**: `Backlog`
   - **Privacy**: Private
   - **Members**: Add founders + operations team
4. Click Create
5. Take a screenshot to verify

### Step 1.2: Create Components

Navigate to Tracker → Operations → Components.

| Component | Description |
|-----------|-------------|
| `IT & Infrastructure` | System administration, tool management, DevOps tasks |
| `Compliance & Legal` | Policy enforcement, audits, legal requirements |
| `Vendor Management` | Vendor evaluation, contract follow-ups, renewals |
| `General Ops` | Cross-functional operational tasks |

For each: click `+ Component` → enter title + description → Create.

### Step 1.3: Create Milestones

Navigate to Tracker → Operations → Milestones.

| Milestone | Description | Status |
|-----------|-------------|--------|
| `Q3 2026 Ops Review` | Quarterly operations review — SOPs, vendors, compliance | Planned |
| `Q4 2026 Ops Review` | Quarterly operations review | Planned |

For each: click `+ Milestone` → enter title + description + status → Create.

---

## TASK 2: Add Templates to Clossette Project

Navigate to Tracker → Clossette → Templates.

Existing templates: [Bug], [Feature], [Design]. Add 3 new ones:

### Template 1: Spike / Research

1. Click `+ New template`
2. Configure:
   - Title: `[Spike] <research topic>`
   - Priority: Medium
   - Default Task Type: Research/Spike (if selectable)
   - Description:
   ```
   ## Research Question
   What do we need to learn?

   ## Context
   Why is this research needed now?

   ## Scope
   - In scope:
   - Out of scope:

   ## Time Box
   - [ ] 1 day
   - [ ] 2-3 days
   - [ ] 1 week

   ## Expected Output
   - [ ] Written summary / ADR
   - [ ] Proof of concept
   - [ ] Recommendation document
   - [ ] Go / No-go decision

   ## Findings
   (To be filled after research)
   ```
3. Save template

### Template 2: Chore / Maintenance

1. Click `+ New template`
2. Configure:
   - Title: `[Chore] <task description>`
   - Priority: Low
   - Default Task Type: Chore (if selectable)
   - Description:
   ```
   ## What
   What maintenance or cleanup is needed?

   ## Why Now
   Why is this task important at this time?

   ## Checklist
   - [ ]
   - [ ]

   ## Verification
   How to verify the chore is complete?
   ```
3. Save template

### Template 3: Hotfix

1. Click `+ New template`
2. Configure:
   - Title: `[Hotfix] <brief description>`
   - Priority: Urgent
   - Default Task Type: Bug (if selectable)
   - Labels: `blocker` (if selectable in template)
   - Description:
   ```
   ## Incident
   What is broken in production?

   ## Impact
   - Users affected:
   - Revenue impact: Yes / No
   - Severity: Critical / High

   ## Root Cause
   (To be filled)

   ## Fix
   (To be filled)

   ## Deployment
   - [ ] Fix applied to main
   - [ ] ./prod_deploy.sh update
   - [ ] ./prod_deploy.sh health — verified
   - [ ] Monitoring confirmed stable

   ## Post-mortem
   - [ ] Incident documented
   - [ ] Preventive action identified
   ```
3. Save template

---

## TASK 3: Add Templates to Design Project

Navigate to Tracker → Design → Templates.

### Template 1: Design Review

1. Click `+ New template`
2. Configure:
   - Title: `[Review] <component or page name>`
   - Priority: Medium
   - Default Task Type: Design (if selectable)
   - Labels: `UX` (if selectable)
   - Description:
   ```
   ## Design to Review
   Figma link:

   ## Review Type
   - [ ] Visual design
   - [ ] Interaction/UX flow
   - [ ] Accessibility
   - [ ] Brand consistency

   ## Context
   What prompted this review?

   ## Reviewer Checklist
   - [ ] Follows design principles (see Product & Design Wiki)
   - [ ] Mobile-first responsive
   - [ ] Dark mode compatible (semantic tokens used)
   - [ ] Accessibility: contrast, keyboard nav, screen reader
   - [ ] Consistent with existing design system

   ## Feedback
   (To be filled by reviewer)

   ## Decision
   - [ ] Approved
   - [ ] Approved with minor changes
   - [ ] Needs revision
   ```
3. Save template

### Template 2: Asset Request

1. Click `+ New template`
2. Configure:
   - Title: `[Asset] <asset description>`
   - Priority: Medium
   - Description:
   ```
   ## Asset Needed
   What visual asset is required?

   ## Type
   - [ ] UI Mockup
   - [ ] Icon
   - [ ] Illustration
   - [ ] Photo
   - [ ] Social media graphic
   - [ ] Video

   ## Specs
   - Dimensions:
   - Format: PNG / SVG / MP4
   - Platform: Web / iOS / Android / Social

   ## Usage Context
   Where will this asset be used?

   ## Reference / Inspiration
   (Links or descriptions)

   ## Deadline
   ```
3. Save template

---

## TASK 4: Add Templates to Marketing Project

Navigate to Tracker → Marketing → Templates.

### Template 1: Content Brief

1. Click `+ New template`
2. Configure:
   - Title: `[Content] <content piece title>`
   - Priority: Medium
   - Default Task Type: Content/Asset (if selectable)
   - Labels: `content` (if selectable)
   - Description:
   ```
   ## Content Piece
   What content needs to be created?

   ## Platform
   - [ ] Instagram
   - [ ] TikTok
   - [ ] Xiaohongshu
   - [ ] Website / Blog
   - [ ] Email
   - [ ] YouTube

   ## Format
   - [ ] Short video (< 60s)
   - [ ] Long video (> 60s)
   - [ ] Static image / carousel
   - [ ] Blog post / article
   - [ ] Email newsletter

   ## Target Audience
   Gen Z Shopper / Young Professional / Indie Designer

   ## Key Message

   ## Call to Action

   ## Assets Needed
   - [ ] Copy / script
   - [ ] Photos / video footage
   - [ ] Graphics (request via [Asset] template in Design project)
   - [ ] Music / audio

   ## Publish Date
   ```
3. Save template

### Template 2: Campaign Launch

1. Click `+ New template`
2. Configure:
   - Title: `[Campaign] <campaign name>`
   - Priority: High
   - Labels: `campaign` (if selectable)
   - Description:
   ```
   ## Campaign Overview
   Campaign name:
   Objective:
   Duration: Start — End

   ## Channels
   - [ ] Instagram
   - [ ] TikTok
   - [ ] Xiaohongshu
   - [ ] Email
   - [ ] Paid Ads
   - [ ] PR

   ## Budget
   Total: $ CAD

   ## Content Pieces Required
   List all content pieces (create each as a [Content] issue):
   1.
   2.
   3.

   ## Pre-Launch Checklist
   - [ ] Campaign brief approved
   - [ ] All content pieces created and approved
   - [ ] Assets delivered by Design team
   - [ ] Social accounts scheduled
   - [ ] Tracking UTMs set up
   - [ ] Landing page ready (if applicable)

   ## KPIs
   - Target reach:
   - Target engagement:
   - Target conversions:

   ## Post-Campaign
   - [ ] Metrics collected
   - [ ] Report written
   - [ ] Learnings documented
   ```
3. Save template

---

## TASK 5: Add Templates to Operations Project

Navigate to Tracker → Operations → Templates.

### Template 1: Incident Report

1. Click `+ New template`
2. Configure:
   - Title: `[Incident] <brief description>`
   - Priority: High
   - Component: `IT & Infrastructure` (if selectable)
   - Description:
   ```
   ## Incident Summary
   What happened?

   ## Timeline
   - Detected: YYYY-MM-DD HH:MM
   - Acknowledged: YYYY-MM-DD HH:MM
   - Resolved: YYYY-MM-DD HH:MM

   ## Impact
   - Users affected:
   - Services affected:
   - Duration:

   ## Severity
   - [ ] SEV-1 (Critical — service down)
   - [ ] SEV-2 (Major — degraded service)
   - [ ] SEV-3 (Minor — limited impact)

   ## Root Cause
   (To be filled after investigation)

   ## Resolution
   What was done to fix it?

   ## Action Items
   - [ ] (Preventive measure with owner and deadline)

   ## Lessons Learned
   ```
3. Save template

### Template 2: SOP Review

1. Click `+ New template`
2. Configure:
   - Title: `[SOP] Review: <SOP name>`
   - Priority: Medium
   - Component: `General Ops` (if selectable)
   - Description:
   ```
   ## SOP to Review
   SOP Card name in Operations Card Space:

   ## Review Reason
   - [ ] Scheduled periodic review
   - [ ] Process changed
   - [ ] Compliance requirement
   - [ ] Incident revealed gap

   ## Review Checklist
   - [ ] Steps are still accurate
   - [ ] Tools/systems referenced still in use
   - [ ] Owner is still correct
   - [ ] Compliance requirements met
   - [ ] No outdated links or references

   ## Changes Made
   (List what was updated)

   ## Next Review Date
   ```
3. Save template

### Template 3: Procurement Request

1. Click `+ New template`
2. Configure:
   - Title: `[Procurement] <tool or service name>`
   - Priority: Medium
   - Component: `Vendor Management` (if selectable)
   - Description:
   ```
   ## Request
   What tool/service is needed?

   ## Justification
   Why do we need this? What problem does it solve?

   ## Options Evaluated
   | Option | Cost (CAD/mo) | Pros | Cons |
   |--------|---------------|------|------|
   | | | | |
   | | | | |

   ## Recommended Option

   ## Budget Impact
   - Monthly cost:
   - Annual cost:
   - Budget category: Infrastructure / SaaS / Marketing / Legal

   ## Approval
   - [ ] Team lead approved
   - [ ] Finance reviewed
   - [ ] Contract reviewed (if applicable)

   ## Setup
   - [ ] Account created
   - [ ] Team access configured
   - [ ] Added to Vendor Card in Finance Card Space
   - [ ] Added to Tool Stack document in Company Wiki
   ```
3. Save template

### Template 4: Policy Review

1. Click `+ New template`
2. Configure:
   - Title: `[Policy] Review: <policy name>`
   - Priority: Medium
   - Component: `Compliance & Legal` (if selectable)
   - Description:
   ```
   ## Policy to Review
   Policy Card name in Operations Card Space:

   ## Review Reason
   - [ ] Scheduled periodic review
   - [ ] Regulatory change
   - [ ] Incident or audit finding
   - [ ] Business change

   ## Review Checklist
   - [ ] Policy still reflects current practices
   - [ ] Legal requirements are met
   - [ ] Effective date is current
   - [ ] Approver is correct
   - [ ] All team members have been notified of changes

   ## Changes Made
   (List what was updated)

   ## Approval
   - [ ] Policy owner approved
   - [ ] Legal reviewed (if applicable)

   ## Next Review Date
   ```
3. Save template

---

## TASK 6: Create Verification Issues in Operations Project

Create 2 test Issues to verify the Operations project works.

### Issue 1: SOP Review

1. Navigate to Tracker → Operations
2. Click `+ New issue` → use the `[SOP] Review` template
3. Fill in:
   - Title: `[SOP] Review: Production Deployment Procedure`
   - Priority: Medium
   - Component: `General Ops`
   - Milestone: `Q3 2026 Ops Review`
4. Save

### Issue 2: Procurement Request

1. Click `+ New issue` → use the `[Procurement]` template
2. Fill in:
   - Title: `[Procurement] Evaluate error monitoring service`
   - Priority: Medium
   - Component: `IT & Infrastructure`
3. Save

---

## TASK 7: Verify All Templates

### Step 7.1: Template Count Verification

| Project | Existing | New | Total |
|---------|----------|-----|-------|
| Clossette (CLOSS) | 3 ([Bug], [Feature], [Design]) | 3 ([Spike], [Chore], [Hotfix]) | 6 |
| Design (DSN) | 0 | 2 ([Review], [Asset]) | 2 |
| Marketing (MARKE) | 0 | 2 ([Content], [Campaign]) | 2 |
| Operations (OPS) | 0 | 4 ([Incident], [SOP], [Procurement], [Policy]) | 4 |
| **Total** | **3** | **11** | **14** |

### Step 7.2: Test Template Usage

1. Navigate to each project → click `+ New issue`
2. Verify the template dropdown shows all templates for that project
3. Select one template → verify the description content populates correctly
4. Cancel (do not create duplicate test issues)
5. Screenshot each project's template list

---

## COMPLETION CHECKLIST

- [ ] Operations project (OPS) created with Classic project type
- [ ] 4 Components in Operations: IT & Infrastructure, Compliance & Legal, Vendor Management, General Ops
- [ ] 2 Milestones in Operations: Q3 2026 Ops Review, Q4 2026 Ops Review
- [ ] 3 new templates in Clossette: [Spike], [Chore], [Hotfix]
- [ ] 2 new templates in Design: [Review], [Asset]
- [ ] 2 new templates in Marketing: [Content], [Campaign]
- [ ] 4 new templates in Operations: [Incident], [SOP], [Procurement], [Policy]
- [ ] 2 verification Issues in Operations project
- [ ] All 14 total templates accessible and usable across 4 projects

## FALLBACK NOTES

1. **Templates not available in project**: Check Settings → Project settings. Some project types may not support templates.
2. **Cannot set default Task Type in template**: Leave unset — users will select the Task Type when creating the Issue.
3. **Cannot set Labels in template**: Leave Labels unset — users will add them manually.
4. **Cannot set Component in template**: Leave Component unset — users will select when creating.
5. **Template description not supporting Markdown**: Plain text with checkboxes should still be functional.
