# Huly Phase 2B Setup — Browser Automation Instructions

> Target: Huly Cloud (app.huly.io), workspace with Phase 1 + Phase 2A completed
> Scope: Phase 2B — Finance + People & Culture domains + Operations supplements
> New: 8 Types, 1 Relation, 2 new Spaces, 2 Types added to existing Operations Space, 5 Saved Views
> Prerequisite: Phase 1 + Phase 2A complete
> Estimated: ~55 browser actions

---

## PRE-FLIGHT CHECK

Before starting, verify Phase 1 + Phase 2A are complete:

1. Navigate to Settings (gear icon in left sidebar or bottom-left)
2. Find "TYPES" section in the left settings menu
3. Confirm Phase 1 Types exist:
   - `Base Document` (with derived: Feature Spec, ADR, PRD, SOP, Brand Guideline, Channel Strategy)
   - `Meeting Note` (top-level)
4. Confirm Phase 2A Types exist:
   - `Design Asset` (derived from File)
   - `Design System Entry` (top-level)
   - `Campaign Plan` (top-level)
   - `Content Piece` (top-level)
5. Navigate to Cards module and confirm these Spaces exist:
   - Phase 1: Engineering, Product, Operations, Meeting Notes
   - Phase 2A: Design, Marketing

If anything is missing, complete the prior phase first.

---

## TASK 1: Create Vendor Type (independent)

1. Navigate to Settings (gear icon in left sidebar or bottom-left)
2. Find "TYPES" section in the left settings menu
3. Click `+` next to "TYPES" header to create a new Type
4. Enter name: `Vendor`
5. Click Create
6. Click on `Vendor` to open it
7. Add 7 properties:

   **Property 1:**
   - Click `+` in Properties
   - Select type: `Text`
   - Enter property name: `Vendor Name`

   **Property 2:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Category`
   - Create a new enum (click `+`):
     - Enum title: `Vendor Category`
     - Add options: `SaaS`, `Cloud`, `Payment`, `Shipping`, `Marketing`, `Legal`
     - Click Save
   - Select the `Vendor Category` enum

   **Property 3:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Status`
   - Create a new enum (click `+`):
     - Enum title: `Vendor Status`
     - Add options: `Active`, `Under Review`, `Inactive`
     - Click Save
   - Select the `Vendor Status` enum

   **Property 4:**
   - Click `+` in Properties
   - Select type: `Number`
   - Enter property name: `Monthly Cost`

   **Property 5:**
   - Click `+` in Properties
   - Select type: `Date`
   - Enter property name: `Contract Renewal`

   **Property 6:**
   - Click `+` in Properties
   - Select type: `Text`
   - Enter property name: `Contact Email`

   **Property 7:**
   - Click `+` in Properties
   - Select type: `URL`
   - Enter property name: `Website`

8. Add the Confidential Tag:
   - Find the "Tags" section on the Vendor Type page
   - Click `+` in Tags area
   - Look for the existing `Confidential` tag (created in Phase 1 on Base Document)
   - If you can select it from a list, do so
   - If not, create a new tag called `Confidential` with:
     - Property: `Access Level` → Type: `Select` → Reuse or recreate enum `Access Level`: `Public`, `Internal`, `Restricted`, `Confidential`
     - Property: `Reason` → Type: `Text`

---

## TASK 2: Create Contract Type (derived from Base Document)

1. Go to Settings → find `Base Document` Type → open it
2. Find the "TYPES" section (derived types area)
3. Click `+` to derive a new Type
4. Enter name: `Contract`
5. Click Create
6. Click on `Contract` to open it
7. Add 6 properties:

   **Property 1:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Contract Type`
   - Create a new enum (click `+`):
     - Enum title: `Contract Type`
     - Add options: `SaaS`, `Service`, `Employment`, `NDA`, `Partnership`
     - Click Save
   - Select the `Contract Type` enum

   **Property 2:**
   - Click `+` in Properties
   - Select type: `Date`
   - Enter property name: `Start Date`

   **Property 3:**
   - Click `+` in Properties
   - Select type: `Date`
   - Enter property name: `End Date`

   **Property 4:**
   - Click `+` in Properties
   - Select type: `Number`
   - Enter property name: `Total Value`

   **Property 5:**
   - Click `+` in Properties
   - Select type: `Checkbox`
   - Enter property name: `Auto Renew`

   **Property 6:**
   - Click `+` in Properties
   - Select type: `Text`
   - Enter property name: `Signed By`

8. Add Tags to Contract:
   - Find the "Tags" section on the Contract Type page
   - Click `+` → add `Confidential` tag (same as Vendor above)
   - Click `+` → add `Review Required` tag (created in Phase 1, has Reviewer, Review Deadline, Review Status properties)

> Contract inherits Status, Owner, Last Reviewed from Base Document.

---

## TASK 3: Create Budget Item Type (independent)

1. Go to Settings → TYPES section (top level)
2. Click `+` next to "TYPES" header
3. Enter name: `Budget Item`
4. Click Create
5. Click on `Budget Item` to open it
6. Add 5 properties:

   **Property 1:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Category`
   - Create a new enum (click `+`):
     - Enum title: `Budget Category`
     - Add options: `Infrastructure`, `SaaS`, `Marketing`, `Payroll`, `Legal`, `Office`
     - Click Save
   - Select the `Budget Category` enum

   **Property 2:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Period`
   - Create a new enum (click `+`):
     - Enum title: `Budget Period`
     - Add options: `Monthly`, `Quarterly`, `Annual`
     - Click Save
   - Select the `Budget Period` enum

   **Property 3:**
   - Click `+` in Properties
   - Select type: `Number`
   - Enter property name: `Budgeted Amount`

   **Property 4:**
   - Click `+` in Properties
   - Select type: `Number`
   - Enter property name: `Actual Amount`

   **Property 5:**
   - Click `+` in Properties
   - Select type: `Number`
   - Enter property name: `Variance`

7. Add the Confidential Tag:
   - Find the "Tags" section → Click `+` → add `Confidential` tag

---

## TASK 4: Define Vendor → Contract Relation

1. Go to Settings → find `Vendor` Type → open it
2. Find the "Relations" section
3. Click `+` to add a relation
4. Configure:
   - Target Type: `Contract`
   - Relation name on Vendor side: `governed by`
   - Relation name on Contract side: `belongs to`
   - Relation type: `1:N` (one Vendor can have many Contracts)

---

## TASK 5: Create Finance Space

1. Navigate to Cards module (left sidebar → "Cards")
2. Click `+ Create Space` (top-left area)
3. Enter name: `Finance`
4. Select Types to include: `Vendor`, `Contract`, `Budget Item`
5. Set as **Private**
6. Owners: financial lead / founder
7. Members: founder only (strictly limited access)
8. Click Create

> IMPORTANT: Finance Space must have the strictest access control. Only add people who need to see financial data.

---

## TASK 6: Create Onboarding Checklist Type (independent)

1. Go to Settings → TYPES section (top level)
2. Click `+` next to "TYPES" header
3. Enter name: `Onboarding Checklist`
4. Click Create
5. Click on `Onboarding Checklist` to open it
6. Add 5 properties:

   - Property: `Role` → Type: `Select` → Create enum `Role`: `Engineer`, `Designer`, `PM`, `Marketing`, `Operations`
   - Property: `Department` → Type: `Select` → Reuse existing `Department` enum (created in Phase 1 with SOP: `Engineering`, `Design`, `Marketing`, `Operations`, `Finance`, `HR`)
   - Property: `Status` → Type: `Select` → Create enum `Onboarding Status`: `Not Started`, `In Progress`, `Completed`
   - Property: `Due Date` → Type: `Date`
   - Property: `Buddy` → Type: `Text`

---

## TASK 7: Create Training Material Type (derived from Base Document)

1. Go to Settings → find `Base Document` Type → open it
2. Find the "TYPES" section (derived types area)
3. Click `+` to derive a new Type
4. Enter name: `Training Material`
5. Click Create
6. Click on `Training Material` to open it
7. Add 4 properties:

   - Property: `Topic` → Type: `Select` → Create enum `Training Topic`: `Technical`, `Product`, `Tool`, `Process`, `Culture`
   - Property: `Format` → Type: `Select` → Create enum `Training Format`: `Document`, `Video`, `Workshop`, `Self-paced`
   - Property: `Difficulty` → Type: `Select` → Create enum `Difficulty`: `Beginner`, `Intermediate`, `Advanced`
   - Property: `Duration` → Type: `Text`

> Training Material inherits Status, Owner, Last Reviewed from Base Document.

---

## TASK 8: Create Role Description Type (independent)

1. Go to Settings → TYPES section (top level)
2. Click `+` next to "TYPES" header
3. Enter name: `Role Description`
4. Click Create
5. Click on `Role Description` to open it
6. Add 4 properties:

   - Property: `Department` → Type: `Select` → Reuse existing `Department` enum
   - Property: `Level` → Type: `Select` → Create enum `Job Level`: `Junior`, `Mid`, `Senior`, `Lead`, `Manager`, `Director`
   - Property: `Status` → Type: `Select` → Create enum `Job Status`: `Active`, `Hiring`, `Frozen`
   - Property: `Reports To` → Type: `Text`

7. Add the Confidential Tag:
   - Find the "Tags" section → Click `+` → add `Confidential` tag

---

## TASK 9: Create People & Culture Space

1. Navigate to Cards module (left sidebar → "Cards")
2. Click `+ Create Space`
3. Enter name: `People & Culture`
4. Select Types to include: `Onboarding Checklist`, `Training Material`, `Role Description`
5. Set as **Private**
6. Owners: HR lead / founder
7. Members: management team
8. Click Create

---

## TASK 10: Add Policy Type to Operations Space (derived from Base Document)

Phase 1 only created SOP in the Operations Space. Now add Policy.

1. Go to Settings → find `Base Document` Type → open it
2. Find the "TYPES" section (derived types area)
3. Click `+` to derive a new Type
4. Enter name: `Policy`
5. Click Create
6. Click on `Policy` to open it
7. Add 4 properties:

   **Property 1:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Policy Area`
   - Create a new enum (click `+`):
     - Enum title: `Policy Area`
     - Add options: `Security`, `Privacy`, `HR`, `Finance`, `Legal`, `General`
     - Click Save
   - Select the `Policy Area` enum

   **Property 2:**
   - Click `+` in Properties
   - Select type: `Date`
   - Enter property name: `Effective Date`

   **Property 3:**
   - Click `+` in Properties
   - Select type: `Date`
   - Enter property name: `Expiry Date`

   **Property 4:**
   - Click `+` in Properties
   - Select type: `Text`
   - Enter property name: `Approver`

8. Add Tags to Policy:
   - Find the "Tags" section → Click `+` → add `Confidential` tag
   - Click `+` → add `Review Required` tag

9. Now add Policy to the existing Operations Space:
   - Navigate to Cards module → find `Operations` space
   - Go to the Space settings (gear icon or context menu on the space)
   - Add `Policy` to the list of included Types
   - Save

> Policy inherits Status, Owner, Last Reviewed from Base Document.

---

## TASK 11: Add Company Handbook Entry Type to Operations Space (derived from Base Document)

1. Go to Settings → find `Base Document` Type → open it
2. Find the "TYPES" section (derived types area)
3. Click `+` to derive a new Type
4. Enter name: `Company Handbook Entry`
5. Click Create
6. Click on `Company Handbook Entry` to open it
7. Add 2 properties:

   **Property 1:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Section`
   - Create a new enum (click `+`):
     - Enum title: `Handbook Section`
     - Add options: `Culture`, `Benefits`, `Policies`, `Tools`, `Onboarding`
     - Click Save
   - Select the `Handbook Section` enum

   **Property 2:**
   - Click `+` in Properties
   - Select type: `Multi-select`
   - Enter property name: `Audience`
   - Create a new enum (click `+`):
     - Enum title: `Audience`
     - Add options: `All`, `Engineering`, `New Hires`, `Managers`
     - Click Save
   - Select the `Audience` enum

8. Add Company Handbook Entry to the existing Operations Space:
   - Navigate to Cards module → find `Operations` space
   - Go to the Space settings
   - Add `Company Handbook Entry` to the list of included Types
   - Save

> Company Handbook Entry inherits Status, Owner, Last Reviewed from Base Document.

---

## TASK 12: Create Verification Cards

### Card 1: Vendor example

1. In Cards module, select `Finance` space → `Vendor` type
2. Click `+ Create Card`
3. Title: `Stripe`
4. Set properties:
   - Vendor Name: `Stripe`
   - Category: `Payment`
   - Status: `Active`
   - Monthly Cost: `0`
   - Contract Renewal: `2027-01-01`
   - Contact Email: `support@stripe.com`
   - Website: `https://stripe.com`
5. Add tag: `Confidential` → set Access Level to `Internal`

### Card 2: Contract example

1. Select `Finance` space → `Contract` type
2. Click `+ Create Card`
3. Title: `Stripe - Payment Processing Agreement`
4. Set properties:
   - Status: `Active` (inherited from Base Document)
   - Owner: `Jadyn`
   - Contract Type: `SaaS`
   - Start Date: `2026-01-01`
   - End Date: `2027-01-01`
   - Total Value: `0`
   - Auto Renew: checked
   - Signed By: `Jadyn`
5. Add tag: `Confidential` → set Access Level to `Internal`
6. Add relation: Go to the `Stripe` Vendor card → in its `governed by` relation, link this Contract
   (Or on this Contract card, use `belongs to` relation to link to the Stripe Vendor)

### Card 3: Budget Item example

1. Select `Finance` space → `Budget Item` type
2. Click `+ Create Card`
3. Title: `2026-Q3 Infrastructure`
4. Set properties:
   - Category: `Infrastructure`
   - Period: `Quarterly`
   - Budgeted Amount: `500`
   - Actual Amount: `0`
   - Variance: `500`
5. Add tag: `Confidential` → set Access Level to `Restricted`

### Card 4: Onboarding Checklist example

1. Select `People & Culture` space → `Onboarding Checklist` type
2. Click `+ Create Card`
3. Title: `Engineer Onboarding - Day 1-5`
4. Set properties:
   - Role: `Engineer`
   - Department: `Engineering`
   - Status: `Not Started`
   - Due Date: `2026-07-15`
   - Buddy: `Jadyn`

### Card 5: Training Material example

1. Select `People & Culture` space → `Training Material` type
2. Click `+ Create Card`
3. Title: `Git Workflow Guide`
4. Set properties:
   - Status: `Active` (inherited from Base Document)
   - Owner: `Jadyn`
   - Topic: `Technical`
   - Format: `Document`
   - Difficulty: `Beginner`
   - Duration: `30min`

### Card 6: Role Description example

1. Select `People & Culture` space → `Role Description` type
2. Click `+ Create Card`
3. Title: `Senior Frontend Engineer`
4. Set properties:
   - Department: `Engineering`
   - Level: `Senior`
   - Status: `Hiring`
   - Reports To: `Tech Lead`
5. Add tag: `Confidential` → set Access Level to `Internal`

### Card 7: Policy example

1. Select `Operations` space → `Policy` type
2. Click `+ Create Card`
3. Title: `Data Privacy Policy`
4. Set properties:
   - Status: `Active` (inherited from Base Document)
   - Owner: `Jadyn`
   - Policy Area: `Privacy`
   - Effective Date: `2026-01-01`
   - Expiry Date: (leave empty)
   - Approver: `CEO`
5. Add tag: `Confidential` → set Access Level to `Internal`
6. Add tag: `Review Required` → set Reviewer to `Legal`, Review Status to `Approved`

### Card 8: Company Handbook Entry example

1. Select `Operations` space → `Company Handbook Entry` type
2. Click `+ Create Card`
3. Title: `Tool Stack Overview`
4. Set properties:
   - Status: `Active` (inherited from Base Document)
   - Owner: `Jadyn`
   - Section: `Tools`
   - Audience: `All`, `Engineering`

---

## TASK 13: Create 5 Saved Views

### View 1: Active Vendors

1. In Cards module, navigate to `Finance` space → `Vendor` type
2. Click the "Filter" button
3. Add filter: `Status` = `Active`
4. Click "Save as"
5. Enter name: `Active Vendors`
6. Set visibility: **Private** (finance data should stay restricted)

### View 2: Expiring Contracts

1. Navigate to `Finance` space → `Contract` type
2. Sort by `End Date` ascending (click the column header)
3. Click "Save as"
4. Enter name: `Expiring Contracts`
5. Set visibility: **Private**

### View 3: Open Positions

1. Navigate to `People & Culture` space → `Role Description` type
2. Click the "Filter" button
3. Add filter: `Status` = `Hiring`
4. Click "Save as"
5. Enter name: `Open Positions`
6. Set visibility: Public

### View 4: Beginner Training

1. Navigate to `People & Culture` space → `Training Material` type
2. Click the "Filter" button
3. Add filter: `Difficulty` = `Beginner`
4. Click "Save as"
5. Enter name: `Beginner Training`
6. Set visibility: Public

### View 5: Active Policies

1. Navigate to `Operations` space → `Policy` type
2. Click the "Filter" button
3. Add filter: `Status` = `Active`
4. Click "Save as"
5. Enter name: `Active Policies`
6. Set visibility: Public

---

## COMPLETION CHECKLIST

After all tasks, verify:

### Types (8 new)

- [ ] `Vendor` — independent top-level Type (has Confidential tag)
- [ ] `Contract` — derived from Base Document (has Confidential + Review Required tags)
- [ ] `Budget Item` — independent top-level Type (has Confidential tag)
- [ ] `Onboarding Checklist` — independent top-level Type
- [ ] `Training Material` — derived from Base Document (inherits Status, Owner, Last Reviewed)
- [ ] `Role Description` — independent top-level Type (has Confidential tag)
- [ ] `Policy` — derived from Base Document (has Confidential + Review Required tags)
- [ ] `Company Handbook Entry` — derived from Base Document

### New Enums Created (15)

- [ ] Vendor Category (6 options)
- [ ] Vendor Status (3 options)
- [ ] Contract Type (5 options)
- [ ] Budget Category (6 options)
- [ ] Budget Period (3 options)
- [ ] Role (5 options)
- [ ] Onboarding Status (3 options)
- [ ] Training Topic (5 options)
- [ ] Training Format (4 options)
- [ ] Difficulty (3 options)
- [ ] Job Level (6 options)
- [ ] Job Status (3 options)
- [ ] Policy Area (6 options)
- [ ] Handbook Section (5 options)
- [ ] Audience (4 options)

### Reused Enums (from Phase 1)

- [ ] `Department` — reused for Onboarding Checklist and Role Description
- [ ] `Confidential` tag — applied to Vendor, Contract, Budget Item, Role Description, Policy
- [ ] `Review Required` tag — applied to Contract, Policy

### Relations (1 new)

- [ ] Vendor ↔ Contract: `governed by` / `belongs to` (1:N)

### Spaces (2 new + 1 updated)

- [ ] `Finance` (Private, strictly limited) — includes Vendor, Contract, Budget Item
- [ ] `People & Culture` (Private) — includes Onboarding Checklist, Training Material, Role Description
- [ ] `Operations` (updated) — now also includes Policy and Company Handbook Entry (alongside SOP)

### Verification Cards (8)

- [ ] `Stripe` (Vendor) — Confidential tag applied, linked to Contract via `governed by`
- [ ] `Stripe - Payment Processing Agreement` (Contract) — inherited Status, linked to Vendor
- [ ] `2026-Q3 Infrastructure` (Budget Item) — Confidential tag applied
- [ ] `Engineer Onboarding - Day 1-5` (Onboarding Checklist) — Department reused from Phase 1
- [ ] `Git Workflow Guide` (Training Material) — inherited Status = Active
- [ ] `Senior Frontend Engineer` (Role Description) — Confidential tag, Status = Hiring
- [ ] `Data Privacy Policy` (Policy) — both Confidential + Review Required tags applied
- [ ] `Tool Stack Overview` (Company Handbook Entry) — Audience multi-select works

### Saved Views (5)

- [ ] `Active Vendors` — Vendors with Active status (Private)
- [ ] `Expiring Contracts` — Contracts sorted by End Date (Private)
- [ ] `Open Positions` — Role Descriptions with Hiring status (Public)
- [ ] `Beginner Training` — Training Materials with Beginner difficulty (Public)
- [ ] `Active Policies` — Policies with Active status (Public)

### Finance Space Access Control

- [ ] Finance Space is Private
- [ ] Only financial lead and founders are members
- [ ] Other team members cannot see Finance Space in their sidebar
