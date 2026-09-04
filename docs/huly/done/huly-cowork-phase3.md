# Huly Phase 3 Setup — Browser Automation Instructions

> Target: Huly Cloud (app.huly.io), workspace with Phase 1 + 2A + 2B completed
> Scope: Phase 3 — Global Saved Views, missing Type creation, Clossette Module Tag deployment, document migration, integrations
> Prerequisite: Phase 1 + 2A + 2B complete (20 Types, 8 Spaces, 6 Relations, 9 Saved Views)
> Estimated: ~60 browser actions

---

## PRE-FLIGHT CHECK

Before starting, verify all prior phases are complete:

1. Navigate to Settings → TYPES
2. Confirm these Types exist:
   - Phase 1: Base Document (with Feature Spec, ADR, PRD, SOP), Meeting Note
   - Phase 2A: Design Asset, Design System Entry, Brand Guideline, Campaign Plan, Content Piece, Channel Strategy
   - Phase 2B: Vendor, Contract, Budget Item, Onboarding Checklist, Training Material, Role Description, Policy, Company Handbook Entry
3. Navigate to Cards module and confirm 8 Spaces exist:
   Engineering, Product, Design, Marketing, Operations, Finance, People & Culture, Meeting Notes

If anything is missing, complete the prior phase first.

---

## TASK 1: Create Tech Design Doc Type (derived from Base Document)

This Type was defined in the architecture but not created in earlier phases.
It is needed before document migration can proceed.

1. Go to Settings → find `Base Document` Type → open it
2. Find the "TYPES" section (derived types area)
3. Click `+` to derive a new Type
4. Enter name: `Tech Design Doc`
5. Click Create
6. Click on `Tech Design Doc` to open it
7. Add 3 properties:

   - Property: `Module` → Type: `Select` → Reuse existing `Module` enum (created in Phase 1: `server`, `web`, `worker`, `infra`)
   - Property: `Design Type` → Type: `Select` → Create enum `Design Type`: `System Design`, `API Design`, `Data Model`, `Algorithm`
   - Property: `Review Status` → Type: `Select` → Create enum `Review Status (Design)`: `Draft`, `Peer Review`, `Approved`

8. Add Tech Design Doc to the Engineering Space:
   - Navigate to Cards module → find `Engineering` space
   - Go to Space settings (gear icon or context menu)
   - Add `Tech Design Doc` to the list of included Types
   - Save

> Tech Design Doc inherits Status, Owner, Last Reviewed from Base Document.

---

## TASK 2: Create API Doc Type (derived from Base Document)

Also needed before document migration.

1. Go to Settings → find `Base Document` Type → open it
2. Find the "TYPES" section (derived types area)
3. Click `+` to derive a new Type
4. Enter name: `API Doc`
5. Click Create
6. Click on `API Doc` to open it
7. Add 5 properties:

   - Property: `Endpoint` → Type: `Text`
   - Property: `HTTP Method` → Type: `Select` → Create enum `HTTP Method`: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
   - Property: `Auth Required` → Type: `Checkbox`
   - Property: `Module` → Type: `Select` → Reuse existing `Module` enum
   - Property: `API Version` → Type: `Text`

8. Add API Doc to the Engineering Space:
   - Navigate to Cards module → find `Engineering` space
   - Go to Space settings
   - Add `API Doc` to the list of included Types
   - Save

9. Define Relation: Feature Spec → API Doc
   - Go to Settings → find `Feature Spec` Type → open it
   - Find the "Relations" section
   - Click `+` to add a relation
   - Configure:
     - Target Type: `API Doc`
     - Relation name on Feature Spec side: `produces`
     - Relation name on API Doc side: `documents`
     - Relation type: `1:N`

> API Doc inherits Status, Owner, Last Reviewed from Base Document.

---

## TASK 3: Create 6 Global Saved Views

### View 1: Active Feature Specs

1. In Cards module, navigate to `Engineering` space → `Feature Spec` type
2. Click the "Filter" button
3. Add filter: `Status` = `Active`
4. Click "Save as"
5. Enter name: `Active Feature Specs`
6. Set visibility: Public

### View 2: In Review PRDs

1. Navigate to `Product` space → `PRD` type
2. Click the "Filter" button
3. Add filter: `Status` = `In Review`
4. Click "Save as"
5. Enter name: `In Review PRDs`
6. Set visibility: Public

### View 3: Needs Review

1. Navigate to any Type that has the `Review Required` tag applied
2. Click the "Filter" button
3. Try to filter by `Review Status` = `Pending` (from the Review Required tag)
4. If this filter is available, save it:
   - Click "Save as"
   - Enter name: `Needs Review`
   - Set visibility: Public
5. If cross-Type filtering is not available, create this view on the Type with the most review items (e.g., PRD or Contract)

### View 4: SOPs Due for Review

1. Navigate to `Operations` space → `SOP` type
2. Click the "Filter" button
3. Try to filter by `Next Review` date (approaching or past due)
4. Sort by `Next Review` ascending
5. Click "Save as"
6. Enter name: `SOPs Due for Review`
7. Set visibility: Public

### View 5: Tech Design Docs

1. Navigate to `Engineering` space → `Tech Design Doc` type
2. Sort by `Last Reviewed` descending (most recently reviewed first)
3. Click "Save as"
4. Enter name: `Tech Design Docs`
5. Set visibility: Public

### View 6: API Reference

1. Navigate to `Engineering` space → `API Doc` type
2. Sort by `Endpoint` alphabetically if possible
3. Click "Save as"
4. Enter name: `API Reference`
5. Set visibility: Public

---

## TASK 4: Deploy Clossette Module Tag to Existing Cards

Apply the `Clossette Module` tag to all product-related verification Cards created in prior phases.

### Card: [web] Add cloth size selection to cart (Feature Spec)

1. Navigate to `Engineering` space → find this Card
2. Click `+` next to Tags
3. Select `Clossette Module` tag
4. Set Product Module: `Cart & Checkout`

### Card: PRD: AI-powered outfit recommendations (PRD)

1. Navigate to `Product` space → find this Card
2. Click `+` next to Tags
3. Select `Clossette Module` tag
4. Set Product Module: `AI Styling`

### Card: Homepage Hero Mockup v2 (Design Asset)

1. Navigate to `Design` space → find this Card
2. Click `+` next to Tags
3. Select `Clossette Module` tag
4. Set Product Module: `Marketplace`

Verification: After applying the tag to all relevant Cards, open any Type's table view and check if you can filter by `Product Module` column to see Cards across different Spaces.

---

## TASK 5: Migrate PRD.md to PRD Card

1. Navigate to `Product` space → `PRD` type
2. Click `+ Create Card`
3. Title: `PRD: Clossette - AI Fashion Marketplace`
4. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Product Area: select all relevant areas
   - Target Persona: `Gen Z Shopper`, `Young Professional`, `Indie Designer`
   - Business Impact: `Revenue`
   - Success Metrics: `Reduce fashion returns to near-zero through AI styling and 3D try-on`
5. In the rich text editor body, paste the contents of `PRD.md`
   - The file covers: Project Vision, Epics, API Contracts, Data Model, Delivery Phases
   - Huly supports Markdown, so the formatting should be preserved
   - If the content is very long, consider splitting into child Cards by Epic

---

## TASK 6: Migrate docs/CODEMAPS/ to Tech Design Doc Cards

Create 5 Tech Design Doc Cards:

### Card 1: Architecture Overview

1. Navigate to `Engineering` space → `Tech Design Doc` type
2. Click `+ Create Card`
3. Title: `Architecture Overview`
4. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Module: `infra`
   - Design Type: `System Design`
   - Review Status: `Approved`
5. Paste contents of `docs/CODEMAPS/architecture.md` into the rich text editor

### Card 2: Backend Architecture Map

1. Click `+ Create Card`
2. Title: `Backend Architecture Map`
3. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Module: `server`
   - Design Type: `System Design`
   - Review Status: `Approved`
4. Paste contents of `docs/CODEMAPS/backend.md`

### Card 3: Frontend Architecture Map

1. Click `+ Create Card`
2. Title: `Frontend Architecture Map`
3. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Module: `web`
   - Design Type: `System Design`
   - Review Status: `Approved`
4. Paste contents of `docs/CODEMAPS/frontend.md`

### Card 4: Data Model Map

1. Click `+ Create Card`
2. Title: `Data Model Map`
3. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Module: `server`
   - Design Type: `Data Model`
   - Review Status: `Approved`
4. Paste contents of `docs/CODEMAPS/data.md`

### Card 5: Dependency Map

1. Click `+ Create Card`
2. Title: `Dependency Map`
3. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Module: `infra`
   - Design Type: `System Design`
   - Review Status: `Approved`
4. Paste contents of `docs/CODEMAPS/dependencies.md`

---

## TASK 7: Migrate Meshy API Reference to API Doc Card

1. Navigate to `Engineering` space → `API Doc` type
2. Click `+ Create Card`
3. Title: `Meshy Image-to-3D API Reference`
4. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Endpoint: `/v2/image-to-3d`
   - HTTP Method: `POST`
   - Auth Required: checked
   - Module: `worker`
   - API Version: `v2`
5. Paste contents of `docs/meshy_Image-to-3D.md` into the rich text editor

---

## TASK 8: Migrate Pose Generation Guide to Tech Design Doc Card

1. Navigate to `Engineering` space → `Tech Design Doc` type
2. Click `+ Create Card`
3. Title: `Pose Generation Guide`
4. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Module: `worker`
   - Design Type: `Algorithm`
   - Review Status: `Approved`
5. Paste contents of `docs/GEN-Pose.md` into the rich text editor

---

## TASK 9: Migrate CLAUDE.md Files to Tech Design Doc Cards

Create 4 Tech Design Doc Cards. These are the human-readable team versions.
The original CLAUDE.md files in the repo must be kept (they serve Claude Code).

### Card 1: Project Overview & Conventions

1. Navigate to `Engineering` space → `Tech Design Doc` type
2. Click `+ Create Card`
3. Title: `Project Overview & Conventions`
4. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Module: `infra`
   - Design Type: `System Design`
   - Review Status: `Approved`
5. Paste contents of root `CLAUDE.md`
6. Add Clossette Module tag → select all modules

### Card 2: Server Module Guide

1. Click `+ Create Card`
2. Title: `Server Module Guide`
3. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Module: `server`
   - Design Type: `System Design`
   - Review Status: `Approved`
4. Paste contents of `server/CLAUDE.md`

### Card 3: Web Module Guide

1. Click `+ Create Card`
2. Title: `Web Module Guide`
3. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Module: `web`
   - Design Type: `System Design`
   - Review Status: `Approved`
4. Paste contents of `web/CLAUDE.md`

### Card 4: Worker Module Guide

1. Click `+ Create Card`
2. Title: `Worker Module Guide`
3. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Module: `worker`
   - Design Type: `System Design`
   - Review Status: `Approved`
4. Paste contents of `worker/CLAUDE.md`

---

## TASK 10: Set Up GitHub Integration

1. Navigate to Settings (gear icon)
2. Find "Integrations" section
3. Look for GitHub integration
4. Click to connect / authorize
5. Select the `Clossette` repository
6. Complete the OAuth authorization flow
7. Verify: Check that GitHub issues or PRs can be referenced from Huly

> Note: If GitHub integration requires steps outside Huly (browser OAuth redirect), follow the prompts and return to Huly when done.

---

## TASK 11: Establish Maintenance Schedule Documentation

Create a Company Handbook Entry documenting the maintenance cadence.

1. Navigate to `Operations` space → `Company Handbook Entry` type
2. Click `+ Create Card`
3. Title: `Knowledge Base Maintenance Schedule`
4. Set properties:
   - Status: `Active`
   - Owner: `Jadyn`
   - Section: `Tools`
   - Audience: `All`, `Managers`
5. In the rich text editor, enter the following content:

Weekly (Every Monday):
- Review all Cards with Review Required tag, Review Status = Pending
- Owner: Each Space Owner

Monthly (1st of each month):
- Check SOP Next Review dates, update expired SOPs
- Clean up Cards with Status = Archived older than 90 days
- Owner: Operations Owner, Each Space Owner

Quarterly:
- Finance: Review Vendor contract renewal dates, update Budget Items
- Audit Clossette Module Tag coverage on all product Cards
- Owner: Finance Lead, PM

Semi-Annual:
- Full audit of Types/Tags/Relations structure
- Remove unused properties and Enums
- Owner: Founders, Tech Lead

---

## COMPLETION CHECKLIST

### New Types (2)

- [ ] `Tech Design Doc` — derived from Base Document, added to Engineering Space
- [ ] `API Doc` — derived from Base Document, added to Engineering Space

### New Enums (3)

- [ ] Design Type (4 options: System Design, API Design, Data Model, Algorithm)
- [ ] Review Status - Design (3 options: Draft, Peer Review, Approved)
- [ ] HTTP Method (5 options: GET, POST, PUT, DELETE, PATCH)

### New Relations (1)

- [ ] Feature Spec ↔ API Doc: `produces` / `documents` (1:N)

### Global Saved Views (6)

- [ ] `Active Feature Specs` — Feature Specs with Active status
- [ ] `In Review PRDs` — PRDs with In Review status
- [ ] `Needs Review` — Cards with Review Required tag, Review Status = Pending
- [ ] `SOPs Due for Review` — SOPs sorted by Next Review date
- [ ] `Tech Design Docs` — All Tech Design Docs sorted by Last Reviewed
- [ ] `API Reference` — All API Docs sorted by Endpoint

### Clossette Module Tag Deployed

- [ ] Applied to Feature Spec verification Card (Cart & Checkout)
- [ ] Applied to PRD verification Card (AI Styling)
- [ ] Applied to Design Asset verification Card
- [ ] Cross-Space filtering by Product Module works

### Document Migration (12 Cards)

- [ ] `PRD: Clossette - AI Fashion Marketplace` — from PRD.md
- [ ] `Architecture Overview` — from docs/CODEMAPS/architecture.md
- [ ] `Backend Architecture Map` — from docs/CODEMAPS/backend.md
- [ ] `Frontend Architecture Map` — from docs/CODEMAPS/frontend.md
- [ ] `Data Model Map` — from docs/CODEMAPS/data.md
- [ ] `Dependency Map` — from docs/CODEMAPS/dependencies.md
- [ ] `Meshy Image-to-3D API Reference` — from docs/meshy_Image-to-3D.md
- [ ] `Pose Generation Guide` — from docs/GEN-Pose.md
- [ ] `Project Overview & Conventions` — from CLAUDE.md (original file kept)
- [ ] `Server Module Guide` — from server/CLAUDE.md (original file kept)
- [ ] `Web Module Guide` — from web/CLAUDE.md (original file kept)
- [ ] `Worker Module Guide` — from worker/CLAUDE.md (original file kept)

### Integration

- [ ] GitHub integration connected to Clossette repository

### Maintenance

- [ ] `Knowledge Base Maintenance Schedule` Card created in Operations space
- [ ] All migrated Cards have Owner = Jadyn

### Full Knowledge Base Summary (after all Phases)

| Metric | Count |
|--------|-------|
| Types | 22 |
| Spaces | 8 |
| Relations | 7 |
| Tags | 4 |
| Saved Views | 15+ |
| Enums | 32+ |
| Cards (content) | 30+ |
