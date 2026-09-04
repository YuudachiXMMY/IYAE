# Huly Phase 1 Setup — Browser Automation Instructions

> Target: Huly Cloud (app.huly.io), fresh empty workspace
> Scope: Phase 1 only — Base Document Type, 5 derived Types, 4 Tags, 4 Spaces, 2 Relations
> Estimated: ~25 browser actions

---

## TASK 1: Create Base Document Type

1. Navigate to Settings (gear icon in left sidebar or bottom-left)
2. Find "TYPES" section in the left settings menu
3. Click the `+` button next to "TYPES" header to create a new Type
4. Enter name: `Base Document`
5. Click "Create"
6. Now add 3 properties to this Type by clicking the `+` button in the Properties section:

   **Property 1:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Status`
   - Create a new enum (click `+` to create dropdown options):
     - Enum title: `Document Status`
     - Add options: `Draft`, `In Review`, `Approved`, `Active`, `Archived`
     - Click Save
   - Select the `Document Status` enum for this property

   **Property 2:**
   - Click `+` in Properties
   - Select type: `Text`
   - Enter property name: `Owner`

   **Property 3:**
   - Click `+` in Properties
   - Select type: `Date`
   - Enter property name: `Last Reviewed`

---

## TASK 2: Create Tags on Base Document

In the same Base Document Type settings page:

**Tag 1: Priority**
1. Find the "Tags" section on the Base Document Type page
2. Click `+` in Tags area
3. Enter tag name: `Priority`
4. Click Create
5. Click on the `Priority` tag to open it
6. Click `+` to add a property:
   - Type: `Select`
   - Name: `Priority Level`
   - Create enum with title `Priority Level`:
     - Options: `P0 - Critical`, `P1 - High`, `P2 - Medium`, `P3 - Low`
     - Click Save
   - Select this enum

**Tag 2: Confidential**
1. Go back to Base Document Type → Tags section
2. Click `+` in Tags area
3. Enter tag name: `Confidential`
4. Click Create
5. Click on the `Confidential` tag
6. Add property 1:
   - Type: `Select`
   - Name: `Access Level`
   - Create enum with title `Access Level`:
     - Options: `Public`, `Internal`, `Restricted`, `Confidential`
     - Click Save
   - Select this enum
7. Add property 2:
   - Type: `Text`
   - Name: `Reason`

**Tag 3: Review Required**
1. Go back to Base Document Type → Tags section
2. Click `+` in Tags area
3. Enter tag name: `Review Required`
4. Click Create
5. Click on the `Review Required` tag
6. Add property 1:
   - Type: `Text`
   - Name: `Reviewer`
7. Add property 2:
   - Type: `Date`
   - Name: `Review Deadline`
8. Add property 3:
   - Type: `Select`
   - Name: `Review Status`
   - Create enum with title `Review Status`:
     - Options: `Pending`, `In Review`, `Approved`, `Rejected`
     - Click Save
   - Select this enum

**Tag 4: Clossette Module**
1. Go back to Base Document Type → Tags section
2. Click `+` in Tags area
3. Enter tag name: `Clossette Module`
4. Click Create
5. Click on the `Clossette Module` tag
6. Add property:
   - Type: `Multi-select`
   - Name: `Product Module`
   - Create enum with title `Product Module`:
     - Options: `AI Styling`, `3D Try-On`, `Marketplace`, `Community`, `Cart & Checkout`, `Avatar`, `Designer Studio`
     - Click Save
   - Select this enum

---

## TASK 3: Derive 5 Core Types from Base Document

Go to Settings → find `Base Document` Type.

### Type 1: Feature Spec

1. On the Base Document Type page, find the "TYPES" section (derived types area)
2. Click `+` to derive a new Type
3. Enter name: `Feature Spec`
4. Click Create
5. Click on `Feature Spec` to open it
6. Add 5 properties:

   - Property: `Epic` → Type: `Text`
   - Property: `Module` → Type: `Select` → Create enum `Module`: `server`, `web`, `worker`, `infra`
   - Property: `Sprint` → Type: `Text`
   - Property: `Complexity` → Type: `Select` → Create enum `Complexity`: `S`, `M`, `L`, `XL`
   - Property: `Target Release` → Type: `Date`

### Type 2: ADR

1. Go back to Base Document → TYPES section
2. Click `+` to derive
3. Enter name: `ADR`
4. Click Create
5. Click on `ADR` to open it
6. Add 5 properties:

   - Property: `Decision Status` → Type: `Select` → Create enum `Decision Status`: `Proposed`, `Accepted`, `Deprecated`, `Superseded`
   - Property: `Decision Date` → Type: `Date`
   - Property: `Deciders` → Type: `Text`
   - Property: `Context` → Type: `Text`
   - Property: `Consequences` → Type: `Text`

### Type 3: PRD

1. Go back to Base Document → TYPES section
2. Click `+` to derive
3. Enter name: `PRD`
4. Click Create
5. Click on `PRD` to open it
6. Add 5 properties:

   - Property: `Product Area` → Type: `Select` → Create enum `Product Area`: `AI Styling`, `3D Try-On`, `Marketplace`, `Community`, `Cart & Checkout`
   - Property: `Target Persona` → Type: `Multi-select` → Create enum `Target Persona`: `Gen Z Shopper`, `Young Professional`, `Indie Designer`
   - Property: `Business Impact` → Type: `Select` → Create enum `Business Impact`: `Revenue`, `Retention`, `Acquisition`, `Engagement`
   - Property: `Target Release` → Type: `Date`
   - Property: `Success Metrics` → Type: `Text`

### Type 4: SOP

1. Go back to Base Document → TYPES section
2. Click `+` to derive
3. Enter name: `SOP`
4. Click Create
5. Click on `SOP` to open it
6. Add 5 properties:

   - Property: `Department` → Type: `Select` → Create enum `Department`: `Engineering`, `Design`, `Marketing`, `Operations`, `Finance`, `HR`
   - Property: `Category` → Type: `Select` → Create enum `SOP Category`: `Process`, `Checklist`, `Runbook`, `Playbook`
   - Property: `Review Cycle` → Type: `Select` → Create enum `Review Cycle`: `Monthly`, `Quarterly`, `Semi-annual`, `Annual`
   - Property: `Next Review` → Type: `Date`
   - Property: `Compliance Required` → Type: `Checkbox`

### Type 5: Meeting Note (Independent Type, NOT derived)

1. Go back to Settings → TYPES section (top level, not inside Base Document)
2. Click `+` next to "TYPES" header to create a NEW top-level Type
3. Enter name: `Meeting Note`
4. Click Create
5. Click on `Meeting Note` to open it
6. Add 5 properties:

   - Property: `Meeting Type` → Type: `Select` → Create enum `Meeting Type`: `Standup`, `Sprint Planning`, `Retrospective`, `Design Review`, `All Hands`, `1:1`, `Ad-hoc`
   - Property: `Date` → Type: `Date`
   - Property: `Attendees` → Type: `Text`
   - Property: `Action Items` → Type: `Text`
   - Property: `Department` → Type: `Select` → reuse existing `Department` enum if possible, otherwise create with: `Engineering`, `Design`, `Marketing`, `Cross-functional`

---

## TASK 4: Define 2 Core Relations

### Relation 1: PRD → Feature Spec

1. Go to Settings → find `PRD` Type → open it
2. Find the "Relations" section
3. Click `+` to add a relation
4. Configure:
   - Target Type: `Feature Spec`
   - Relation name on PRD side: `drives`
   - Relation name on Feature Spec side: `implements`
   - Relation type: `1:N` (one PRD drives many Feature Specs)

### Relation 2: Feature Spec → ADR

1. Go to Settings → find `Feature Spec` Type → open it
2. Find the "Relations" section
3. Click `+` to add a relation
4. Configure:
   - Target Type: `ADR`
   - Relation name on Feature Spec side: `decided by`
   - Relation name on ADR side: `affects`
   - Relation type: `N:N` (many Feature Specs can reference many ADRs)

---

## TASK 5: Create 4 Core Spaces

Navigate to the Cards module (in the left sidebar, look for "Cards").

### Space 1: Engineering

1. Click `+ Create Space` (top-left area)
2. Enter name: `Engineering`
3. Select Types to include: `Feature Spec`, `ADR`
4. Set as Private
5. Configure owners/members as needed
6. Click Create

### Space 2: Product

1. Click `+ Create Space`
2. Enter name: `Product`
3. Select Types to include: `PRD`
4. Set as Private
5. Click Create

### Space 3: Operations

1. Click `+ Create Space`
2. Enter name: `Operations`
3. Select Types to include: `SOP`
4. Set visibility to allow all members
5. Click Create

### Space 4: Meeting Notes

1. Click `+ Create Space`
2. Enter name: `Meeting Notes`
3. Select Types to include: `Meeting Note`
4. Set visibility to allow all members
5. Click Create

---

## TASK 6: Create Verification Cards (1 per Type)

### Card 1: Feature Spec example

1. In Cards module, select `Engineering` space → `Feature Spec` type
2. Click `+ Create Card`
3. Title: `[web] Add cloth size selection to cart`
4. Set properties:
   - Status: `Approved`
   - Owner: `Jadyn`
   - Epic: `Cart & Checkout`
   - Module: `web`
   - Sprint: `Sprint-25`
   - Complexity: `M`
5. Add tag: `Priority` → set Priority Level to `P1 - High`
6. Add tag: `Clossette Module` → select `Cart & Checkout`

### Card 2: ADR example

1. Select `Engineering` space → `ADR` type
2. Click `+ Create Card`
3. Title: `ADR-001: Use Stripe for payment processing`
4. Set properties:
   - Status: `Approved`
   - Decision Status: `Accepted`
   - Decision Date: `2026-06-01`
   - Deciders: `Jadyn, CTO`
   - Context: `Need a payment processor that supports Canadian market with Stripe Connect for marketplace payouts`
   - Consequences: `Vendor lock-in to Stripe ecosystem; checkout flow depends on Stripe.js`
5. Add relation: `affects` → link to the Feature Spec card created above

### Card 3: PRD example

1. Select `Product` space → `PRD` type
2. Click `+ Create Card`
3. Title: `PRD: AI-powered outfit recommendations`
4. Set properties:
   - Status: `Draft`
   - Owner: `Jadyn`
   - Product Area: `AI Styling`
   - Target Persona: `Gen Z Shopper`, `Young Professional`
   - Business Impact: `Engagement`
   - Success Metrics: `30% increase in outfit saves within 4 weeks of launch`
5. Add relation: `drives` → link to the Feature Spec card

### Card 4: SOP example

1. Select `Operations` space → `SOP` type
2. Click `+ Create Card`
3. Title: `SOP: Production deployment procedure`
4. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Department: `Engineering`
   - Category: `Runbook`
   - Review Cycle: `Quarterly`
   - Next Review: `2026-09-01`
   - Compliance Required: checked

### Card 5: Meeting Note example

1. Select `Meeting Notes` space → `Meeting Note` type
2. Click `+ Create Card`
3. Title: `2026-06-19 Sprint Planning: Sprint-25`
4. Set properties:
   - Meeting Type: `Sprint Planning`
   - Date: `2026-06-19`
   - Attendees: `Jadyn, Dev Team`
   - Action Items: `1. Finalize cart size selection UI 2. Start Stripe webhook testing`
   - Department: `Engineering`

---

## COMPLETION CHECKLIST

After all tasks, verify:
- [ ] 2 top-level Types exist: `Base Document`, `Meeting Note`
- [ ] 4 derived Types under Base Document: `Feature Spec`, `ADR`, `PRD`, `SOP`
- [ ] 4 Tags on Base Document: `Priority`, `Confidential`, `Review Required`, `Clossette Module`
- [ ] 2 Relations defined: PRD→Feature Spec (1:N), Feature Spec→ADR (N:N)
- [ ] 4 Spaces created: Engineering, Product, Operations, Meeting Notes
- [ ] 5 example Cards created (one per Type)
- [ ] Relations between example cards are linked
