# Huly Phase 5: Designer Partnership Management — Browser Automation Instructions

> Target: Huly Cloud (app.huly.io), workspace with Phase 1-4E completed
> Scope: Extend Enums, add Tracker templates, create SOP/Onboarding Cards, configure Saved Views for designer partnership workflow
> Prerequisite: Phase 1-3 Cards (20+ Types, 8 Spaces) + Phase 4A-4E Tracker (4 Projects: CLOSS, DSN, MARKE, OPS with 14 templates) + Phase 4B Processes (5 Processes) + Phase 4C Documents (4 Teamspaces) + Phase 4D Planner
> Purpose: Enable end-to-end designer cooperation management — from outreach through contract to platform onboarding
> Estimated: ~35 browser actions

---

## PRE-FLIGHT CHECK

Before starting, verify the workspace is ready:

1. Navigate to Cards module → confirm 8 Card Spaces exist (+ Default = 9 total)
2. Navigate to Cards → Finance space → confirm Vendor and Contract types are present with Vendor→Contract Relation
3. Navigate to Cards → Operations space → confirm SOP type is present
4. Navigate to Cards → People & Culture space → confirm Onboarding Checklist type is present
5. Navigate to Tracker module → confirm 4 Projects: Clossette (CLOSS), Design (DSN), Marketing (MARKE), Operations (OPS)
6. Navigate to Processes module → confirm 5 Processes exist (Content Publishing, Document Approval, Contract Lifecycle, Onboarding, Campaign Lifecycle)

If anything is missing, complete prior phases first.

---

## TASK 1: Extend Existing Enums

### Step 1.1: Add "Designer Partner" to Vendor Category Enum

1. Navigate to Settings → Types
2. Find and open the `Vendor` type
3. Click on the `Category` property → find the linked Enum (Vendor Category)
4. Edit the Enum → click `+` to add a new option
5. Enter: `Designer Partner`
6. Save
7. Take a screenshot to verify the new option appears

### Step 1.2: Add "Designer Partner" to Role Enum

1. In Settings → Types, find and open the `Onboarding Checklist` type
2. Click on the `Role` property → find the linked Enum (Role)
3. Edit the Enum → click `+` to add a new option
4. Enter: `Designer Partner`
5. Save
6. Take a screenshot to verify

### Step 1.3: Verify Enum Changes

1. Navigate to Cards → Finance space → click `+ Create Card` → select `Vendor`
2. Click on the Category dropdown → confirm `Designer Partner` appears as an option
3. Cancel (do not create the card yet — that is TASK 3)
4. Navigate to Cards → People & Culture space → click `+ Create Card` → select `Onboarding Checklist`
5. Click on the Role dropdown → confirm `Designer Partner` appears
6. Cancel

---

## TASK 2: Create Designer Evaluation SOP Card

### Step 2.1: Create the SOP Card

1. Navigate to Cards → Operations space
2. Click `+ Create Card` → select `SOP`
3. Fill in:
   - **Title**: `SOP: Designer Partnership Evaluation`
   - **Status**: Active
   - **Owner**: (your name or founder name)
   - **Department**: Operations
   - **Category**: Process
   - **Review Cycle**: Quarterly
   - **Next Review**: (3 months from today)
   - **Compliance Required**: No

4. In the rich text body, enter the following content:

```
## Purpose

Standardized process for evaluating potential designer partners before onboarding them to the Clossette marketplace.

## Scope

Applies to all designer partnership inquiries — whether inbound (designers approaching us) or outbound (our recruitment efforts).

## Evaluation Criteria

### 1. Brand & Style Fit (Weight: 30%)
- Does the designer's aesthetic align with Clossette's target audience (Gen Z, young millennials)?
- Is the style complementary to (not duplicating) existing marketplace offerings?
- Does the brand have a distinct visual identity?

### 2. Product Quality (Weight: 25%)
- Material quality meets marketplace standards
- Construction and finishing are professional
- Sizing is consistent and documented
- Products are suitable for 3D model generation

### 3. Brand Values Alignment (Weight: 20%)
- Sustainability practices (if applicable)
- Ethical production
- Inclusivity in sizing and marketing
- Alignment with Clossette's brand positioning

### 4. Business Readiness (Weight: 15%)
- Ability to fulfill orders reliably
- Existing e-commerce experience (preferred, not required)
- Willingness to provide product photography and 3D assets
- Responsive communication

### 5. Pricing & Commercial Terms (Weight: 10%)
- Price point fits target audience ($30-$300 range typical)
- Commission structure acceptable
- Return policy compatible with Clossette's standards

## Evaluation Scoring

| Score | Meaning | Action |
|-------|---------|--------|
| 4.0-5.0 | Excellent fit | Proceed to contract |
| 3.0-3.9 | Good fit with minor gaps | Proceed with conditions |
| 2.0-2.9 | Marginal fit | Revisit in 3 months |
| Below 2.0 | Not a fit | Decline with feedback |

## Process Steps

1. Receive designer inquiry or identify outreach target
2. Create Tracker Issue using [Outreach] Designer template (Marketing project)
3. Collect portfolio, lookbook, and pricing sheet
4. Score against 5 criteria above
5. Decision: Proceed / Revisit / Decline
6. If Proceed → create Vendor + Contract Cards in Finance space
7. If Proceed → create Onboarding Checklist in People & Culture space
8. If Proceed → create Tracker Issue using [Onboarding] Designer template (Operations project)

## Document History

| Date | Change | By |
|------|--------|----|
| (today) | Initial version | (your name) |
```

5. Take a screenshot to verify

---

## TASK 3: Create Example Vendor + Contract Cards (Designer Partner)

### Step 3.1: Create Vendor Card

1. Navigate to Cards → Finance space
2. Click `+ Create Card` → select `Vendor`
3. Fill in:
   - **Vendor Name**: `[Example] Luna Studio`
   - **Category**: `Designer Partner`
   - **Status**: `Under Review`
   - **Monthly Cost**: `0` (commission-based)
   - **Contact Email**: `example@lunastudio.design`
   - **Website**: (leave blank or enter placeholder)
4. Add Tag: `Confidential` → Access Level: Internal
5. Save
6. Take a screenshot

### Step 3.2: Create Contract Card

1. In Finance space → click `+ Create Card` → select `Contract`
2. Fill in:
   - **Title**: `Luna Studio - Designer Partnership Agreement`
   - **Contract Type**: `Partnership`
   - **Status**: Draft
   - **Start Date**: (today)
   - **End Date**: (1 year from today)
   - **Total Value**: `0` (commission-based, no upfront cost)
   - **Auto Renew**: Yes
   - **Signed By**: (leave blank — not yet signed)
3. Add Tags: `Confidential` (Access Level: Restricted), `Review Required` (Review Status: Pending)
4. Save

### Step 3.3: Link Vendor → Contract Relation

1. Open the `[Example] Luna Studio` Vendor Card
2. Find the Relations section
3. Click `+` → select the `governed by` relation → choose `Luna Studio - Designer Partnership Agreement`
4. Verify the reverse relation appears on the Contract Card (`belongs to` → Luna Studio)
5. Take a screenshot showing the linked relation

### Step 3.4: Start Contract Lifecycle Process

1. Open the Contract Card `Luna Studio - Designer Partnership Agreement`
2. Start the `Contract Lifecycle` process (look for "Start Process" or similar button)
3. Verify the initial state is `Drafted`
4. Try advancing to `Under Review`
5. Take a screenshot showing the active process state

---

## TASK 4: Create Designer Onboarding Checklist Card

### Step 4.1: Create the Card

1. Navigate to Cards → People & Culture space
2. Click `+ Create Card` → select `Onboarding Checklist`
3. Fill in:
   - **Title**: `Designer Onboarding: [Example] Luna Studio`
   - **Role**: `Designer Partner`
   - **Department**: `Operations`
   - **Status**: `Not Started`
   - **Due Date**: (2 weeks from today)
   - **Buddy**: (your name or team lead)

4. In the rich text body, enter:

```
## Designer Partner Onboarding Checklist

### Phase 1: Account & Store Setup
- [ ] Designer account created on Clossette platform
- [ ] Store page URL configured
- [ ] Brand logo and banner uploaded
- [ ] Designer bio and brand story written
- [ ] Contact information verified

### Phase 2: Product Catalog
- [ ] First collection (minimum 5 products) uploaded
- [ ] Product descriptions written for all items
- [ ] Product photography meets quality standards
- [ ] Sizing chart provided and verified
- [ ] Price points set within agreed range

### Phase 3: 3D & Technical Assets
- [ ] Product images submitted for 3D model generation
- [ ] 3D models generated and QA-reviewed
- [ ] Virtual try-on verified on at least 3 products
- [ ] Size selection working correctly for all products

### Phase 4: Payment & Legal
- [ ] Payment information configured (Stripe Connect)
- [ ] Commission structure confirmed in contract
- [ ] Return policy agreed and documented
- [ ] Tax information collected

### Phase 5: Go-Live
- [ ] QA review of complete store page
- [ ] Designer preview and final approval
- [ ] Marketing announcement content prepared
- [ ] Store page set to live
- [ ] Post-launch check: orders flowing correctly
```

5. Save
6. Take a screenshot

### Step 4.2: Start Onboarding Process

1. Open the Onboarding Card just created
2. Start the `Onboarding` process
3. Verify initial state is `Not Started`
4. Take a screenshot

---

## TASK 5: Add Tracker Template — Operations [Onboarding] Designer

### Step 5.1: Create the Template

1. Navigate to Tracker → Operations → Templates
2. Click `+ New template`
3. Configure:
   - **Title**: `[Onboarding] Designer: <designer name>`
   - **Priority**: Medium
   - **Component**: `Vendor Management` (if selectable)
   - **Description**:

```
## Designer Info
- Brand name:
- Contact person:
- Email:
- Portfolio / website:
- Instagram / social:

## Evaluation (refer to SOP: Designer Partnership Evaluation)
- [ ] Portfolio reviewed
- [ ] Style fit assessment: Score __/5
- [ ] Product quality assessment: Score __/5
- [ ] Brand values alignment: Score __/5
- [ ] Business readiness: Score __/5
- [ ] Pricing compatibility: Score __/5
- [ ] Overall score: __/5
- [ ] Decision: Proceed / Revisit / Decline

## Contract (Finance Space)
- [ ] Vendor Card created in Finance space
- [ ] Contract Card created and linked
- [ ] Contract terms drafted
- [ ] Legal review completed
- [ ] Contract signed by both parties
- [ ] Contract Lifecycle Process started

## Platform Setup
- [ ] Designer account created
- [ ] Store page configured
- [ ] First collection uploaded (min 5 products)
- [ ] Product photography QA passed
- [ ] 3D model generation requested
- [ ] 3D models QA reviewed
- [ ] Sizing chart verified
- [ ] Payment (Stripe Connect) configured

## Go-Live
- [ ] QA review of store page
- [ ] Designer final approval
- [ ] Onboarding Checklist Card completed in P&C space
- [ ] Marketing announcement scheduled
- [ ] Store set to live
- [ ] Post-launch monitoring (first 48h)
```

4. Save template
5. Take a screenshot

---

## TASK 6: Add Tracker Template — Marketing [Outreach] Designer

### Step 6.1: Create the Template

1. Navigate to Tracker → Marketing → Templates
2. Click `+ New template`
3. Configure:
   - **Title**: `[Outreach] Designer: <designer/brand name>`
   - **Priority**: Medium
   - **Description**:

```
## Target Designer
- Brand name:
- Designer name:
- Location:
- Instagram: @
- Website:
- Followers / audience size:

## Why This Designer?
What makes them a good fit for Clossette?

## Discovery Channel
- [ ] Instagram discovery
- [ ] Xiaohongshu
- [ ] Industry event / market
- [ ] Referral from:
- [ ] Inbound inquiry
- [ ] Other:

## Outreach Plan
- [ ] Research completed (brand, style, price range, audience)
- [ ] Initial message drafted
- [ ] Sent via: Email / DM / Other
- [ ] Date sent:

## Follow-Up Log
| Date | Action | Response |
|------|--------|----------|
| | | |

## Outcome
- [ ] Interested — proceed to evaluation (create [Onboarding] Designer issue in OPS)
- [ ] Not interested — reason:
- [ ] No response — follow up on:
- [ ] Declined — reason:

## Notes
```

4. Save template
5. Take a screenshot

---

## TASK 7: Create Saved Views

### Step 7.1: Designer Partners View (Finance)

1. Navigate to Cards → Finance space
2. Open the Vendor type table view
3. Click Filter → set: Category = `Designer Partner`
4. Click "Save as" → name: `Designer Partners`
5. Set visibility: Private (Finance team only)
6. Verify it appears in the sidebar

### Step 7.2: Partnership SOPs View (Operations)

1. Navigate to Cards → Operations space
2. Open the SOP type table view
3. Click Filter → set: Category = `Process`
4. Click "Save as" → name: `Partnership & Process SOPs`
5. Set visibility: Public
6. Verify it appears in the sidebar

### Step 7.3: Screenshot Both Views

Take a screenshot of each Saved View showing in the sidebar.

---

## TASK 8: Verify End-to-End Flow

This is a validation task. Walk through the complete designer partnership flow using existing data.

### Step 8.1: Verify Marketing → Tracker Link

1. Navigate to Cards → Marketing space
2. Open any Campaign Plan card (or the example from Phase 2A)
3. Confirm Campaign Lifecycle Process is accessible
4. Navigate to Tracker → Marketing → verify [Outreach] template is available via `+ New issue`
5. Take a screenshot

### Step 8.2: Verify Tracker → Cards Link

1. Navigate to Tracker → Operations
2. Verify [Onboarding] Designer template is available via `+ New issue`
3. Open an existing issue or create a test issue using the template
4. Verify the description mentions creating Cards in Finance and P&C spaces
5. Take a screenshot

### Step 8.3: Verify Finance Flow

1. Navigate to Cards → Finance space
2. Open `[Example] Luna Studio` Vendor Card
3. Verify: Category = Designer Partner, Relation to Contract exists
4. Open the linked Contract Card
5. Verify Contract Lifecycle Process state
6. Take a screenshot

### Step 8.4: Verify Onboarding Flow

1. Navigate to Cards → People & Culture space
2. Open `Designer Onboarding: [Example] Luna Studio`
3. Verify: Role = Designer Partner, Onboarding Process state visible
4. Take a screenshot

### Step 8.5: Cross-Module Navigation Summary

Report the following navigation paths work:

| From | To | Method |
|------|----|--------|
| Marketing Campaign Plan | Marketing Tracker [Outreach] | Module switch |
| Marketing Tracker [Outreach] issue | OPS Tracker [Onboarding] issue | Create linked issue or manual |
| OPS Tracker [Onboarding] issue | Finance Vendor Card | Mentioned in template description |
| Finance Vendor Card | Finance Contract Card | Relation link |
| Finance Contract Card | P&C Onboarding Card | Mentioned in template description |
| Contract Card | Contract Lifecycle Process | Process state on card |
| Onboarding Card | Onboarding Process | Process state on card |
| Operations SOP | Evaluation criteria reference | Card search |

Take a final screenshot and report any broken links or missing connections.

---

## COMPLETION CHECKLIST

- [ ] 2 Enum options added: Vendor Category (`Designer Partner`), Role (`Designer Partner`)
- [ ] SOP Card created: `SOP: Designer Partnership Evaluation` in Operations space
- [ ] Vendor Card created: `[Example] Luna Studio` with Category = Designer Partner
- [ ] Contract Card created: `Luna Studio - Designer Partnership Agreement` with Partnership type
- [ ] Vendor → Contract Relation verified (governed by / belongs to)
- [ ] Contract Lifecycle Process started and state visible
- [ ] Onboarding Checklist Card created: `Designer Onboarding: [Example] Luna Studio`
- [ ] Onboarding Process started and state visible
- [ ] Tracker template added to Operations: `[Onboarding] Designer`
- [ ] Tracker template added to Marketing: `[Outreach] Designer`
- [ ] 2 Saved Views created: `Designer Partners` (Finance), `Partnership & Process SOPs` (Operations)
- [ ] End-to-end flow verified: Campaign → Outreach → Evaluation → Contract → Onboarding → Go-Live
- [ ] All templates total: Clossette 6 + Design 2 + Marketing 4 + Operations 6 = **18 templates**

## FALLBACK NOTES

1. **Cannot filter by new Enum value**: The Enum option may need a card instance using it before it appears in filters. Create the Vendor Card (Task 3) first, then retry the Saved View.
2. **Process not startable on card**: Check if the Process is correctly attached to the Card Type. Navigate to Processes module to verify attachment.
3. **Relation not showing on Contract**: Re-open the Vendor Card and create the relation from the Vendor side (governed by → Contract).
4. **Template description too long**: If Huly truncates template descriptions, keep only the checklist items and remove explanatory text.
5. **Cannot set Component in template**: Leave Component unset — users will select when creating the Issue.
