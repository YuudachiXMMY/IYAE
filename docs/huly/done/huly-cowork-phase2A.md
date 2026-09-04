# Huly Phase 2A Setup — Browser Automation Instructions

> Target: Huly Cloud (app.huly.io), workspace with Phase 1 already completed
> Scope: Phase 2A — Design + Marketing domains (6 new Types, 3 Relations, 2 Spaces, 4 Saved Views)
> Prerequisite: Phase 1 complete (Base Document, 5 derived Types, 4 Tags, 4 Spaces, 2 Relations)
> Estimated: ~50 browser actions

---

## PRE-FLIGHT CHECK

Before starting, verify Phase 1 is complete:

1. Navigate to Settings (gear icon in left sidebar or bottom-left)
2. Find "TYPES" section in the left settings menu
3. Confirm these Types exist:
   - `Base Document` (with Status, Owner, Last Reviewed properties)
   - `Feature Spec`, `ADR`, `PRD`, `SOP` (derived from Base Document)
   - `Meeting Note` (top-level)
4. Confirm these Tags exist on Base Document: `Priority`, `Confidential`, `Review Required`, `Clossette Module`
5. Navigate to Cards module and confirm these Spaces exist: Engineering, Product, Operations, Meeting Notes

If anything is missing, complete Phase 1 first using `huly-cowork-phase1.md`.

---

## TASK 1: Create Design Asset Type (derived from File)

Design Asset derives from Huly's built-in `File` Type, NOT from Base Document.
This gives each Design Asset card a file upload area.

1. Navigate to Settings (gear icon in left sidebar or bottom-left)
2. Find "TYPES" section in the left settings menu
3. Look for the built-in `File` Type (this is a system Type that already exists)
4. Click on `File` to open it
5. Find the "TYPES" section on the File Type page (this is where derived Types are listed)
6. Click `+` to derive a new Type
7. Enter name: `Design Asset`
8. Click "Create"
9. Click on `Design Asset` to open it
10. Add 5 properties:

    **Property 1:**
    - Click `+` in Properties
    - Select type: `Select`
    - Enter property name: `Asset Type`
    - Create a new enum (click `+`):
      - Enum title: `Asset Type`
      - Add options: `UI Mockup`, `Icon`, `Illustration`, `Photo`, `3D Model`, `Video`
      - Click Save
    - Select the `Asset Type` enum

    **Property 2:**
    - Click `+` in Properties
    - Select type: `Select`
    - Enter property name: `Design Tool`
    - Create a new enum (click `+`):
      - Enum title: `Design Tool`
      - Add options: `Canva`, `Figma`, `Blender`, `Photoshop`, `Illustrator`, `Other`
      - Click Save
    - Select the `Design Tool` enum

    **Property 3:**
    - Click `+` in Properties
    - Select type: `Text`
    - Enter property name: `Version`

    **Property 4:**
    - Click `+` in Properties
    - Select type: `Select`
    - Enter property name: `Status`
    - Create a new enum (click `+`):
      - Enum title: `Asset Status`
      - Add options: `WIP`, `Ready for Review`, `Approved`, `Delivered`
      - Click Save
    - Select the `Asset Status` enum

    **Property 5:**
    - Click `+` in Properties
    - Select type: `Multi-select`
    - Enter property name: `Platform`
    - Create a new enum (click `+`):
      - Enum title: `Platform`
      - Add options: `Web`, `iOS`, `Android`
      - Click Save
    - Select the `Platform` enum

---

## TASK 2: Create Design System Entry Type (independent)

This is an independent top-level Type (not derived from Base Document or File).

1. Go to Settings → TYPES section (top level)
2. Click `+` next to "TYPES" header to create a new Type
3. Enter name: `Design System Entry`
4. Click Create
5. Click on `Design System Entry` to open it
6. Add 6 properties:

   - Property: `Component Name` → Type: `Text`
   - Property: `Category` → Type: `Select` → Create enum `Component Category`: `Primitive`, `Composite`, `Layout`, `Motion`, `Token`
   - Property: `Platform` → Type: `Multi-select` → Reuse existing `Platform` enum (created in TASK 1)
   - Property: `Status` → Type: `Select` → Create enum `Component Status`: `Draft`, `Stable`, `Deprecated`
   - Property: `Figma Link` → Type: `URL`
   - Property: `Code Path` → Type: `Text`

---

## TASK 3: Create Brand Guideline Type (derived from Base Document)

1. Go to Settings → find `Base Document` Type → open it
2. Find the "TYPES" section (derived types area)
3. Click `+` to derive a new Type
4. Enter name: `Brand Guideline`
5. Click Create
6. Click on `Brand Guideline` to open it
7. Add 2 properties:

   - Property: `Guideline Area` → Type: `Select` → Create enum `Guideline Area`: `Logo`, `Color`, `Typography`, `Imagery`, `Voice & Tone`, `Motion`
   - Property: `Version` → Type: `Text`

> Brand Guideline inherits Status, Owner, Last Reviewed from Base Document.

---

## TASK 4: Create Campaign Plan Type (independent)

1. Go to Settings → TYPES section (top level)
2. Click `+` next to "TYPES" header
3. Enter name: `Campaign Plan`
4. Click Create
5. Click on `Campaign Plan` to open it
6. Add 8 properties:

   **Property 1:**
   - Click `+` in Properties
   - Select type: `Text`
   - Enter property name: `Campaign Name`

   **Property 2:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Status`
   - Create a new enum (click `+`):
     - Enum title: `Campaign Status`
     - Add options: `Planning`, `Active`, `Paused`, `Completed`, `Cancelled`
     - Click Save
   - Select the `Campaign Status` enum

   **Property 3:**
   - Click `+` in Properties
   - Select type: `Multi-select`
   - Enter property name: `Channel`
   - Create a new enum (click `+`):
     - Enum title: `Channel`
     - Add options: `Instagram`, `TikTok`, `Xiaohongshu`, `Email`, `PR`, `Paid Ads`, `SEO`
     - Click Save
   - Select the `Channel` enum

   **Property 4:**
   - Click `+` in Properties
   - Select type: `Number`
   - Enter property name: `Budget`

   **Property 5:**
   - Click `+` in Properties
   - Select type: `Date`
   - Enter property name: `Start Date`

   **Property 6:**
   - Click `+` in Properties
   - Select type: `Date`
   - Enter property name: `End Date`

   **Property 7:**
   - Click `+` in Properties
   - Select type: `Multi-select`
   - Enter property name: `Target Audience`
   - Create a new enum (click `+`):
     - Enum title: `Target Audience`
     - Add options: `Gen Z`, `Young Professional`, `Designer`
     - Click Save
   - Select the `Target Audience` enum

   **Property 8:**
   - Click `+` in Properties
   - Select type: `Text`
   - Enter property name: `KPI`

---

## TASK 5: Create Content Piece Type (independent)

1. Go to Settings → TYPES section (top level)
2. Click `+` next to "TYPES" header
3. Enter name: `Content Piece`
4. Click Create
5. Click on `Content Piece` to open it
6. Add 6 properties:

   **Property 1:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Content Type`
   - Create a new enum (click `+`):
     - Enum title: `Content Type`
     - Add options: `Blog Post`, `Social Post`, `Email`, `Video`, `Press Release`, `Landing Page`
     - Click Save
   - Select the `Content Type` enum

   **Property 2:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Platform`
   - Create a new enum (click `+`):
     - Enum title: `Content Platform`
     - Add options: `Instagram`, `TikTok`, `Xiaohongshu`, `Website`, `Email`, `YouTube`
     - Click Save
   - Select the `Content Platform` enum

   **Property 3:**
   - Click `+` in Properties
   - Select type: `Select`
   - Enter property name: `Status`
   - Create a new enum (click `+`):
     - Enum title: `Content Status`
     - Add options: `Ideation`, `Drafting`, `Review`, `Scheduled`, `Published`
     - Click Save
   - Select the `Content Status` enum

   **Property 4:**
   - Click `+` in Properties
   - Select type: `Date`
   - Enter property name: `Publish Date`

   **Property 5:**
   - Click `+` in Properties
   - Select type: `Text`
   - Enter property name: `Author`

   **Property 6:**
   - Click `+` in Properties
   - Select type: `URL`
   - Enter property name: `Content Link`

7. Now add the Priority Tag to Content Piece:
   - Find the "Tags" section on the Content Piece Type page
   - Click `+` in Tags area
   - Look for the existing `Priority` tag (created in Phase 1 on Base Document)
   - If you can select `Priority` from a list, do so
   - If not, create a new tag called `Priority` with the same structure:
     - Property: `Priority Level` → Type: `Select` → Reuse or recreate enum `Priority Level`: `P0 - Critical`, `P1 - High`, `P2 - Medium`, `P3 - Low`

---

## TASK 6: Create Channel Strategy Type (derived from Base Document)

1. Go to Settings → find `Base Document` Type → open it
2. Find the "TYPES" section (derived types area)
3. Click `+` to derive a new Type
4. Enter name: `Channel Strategy`
5. Click Create
6. Click on `Channel Strategy` to open it
7. Add 3 properties:

   - Property: `Channel` → Type: `Select` → Reuse existing `Channel` enum (created in TASK 4) if possible, otherwise create: `Instagram`, `TikTok`, `Xiaohongshu`, `Email`, `SEO`, `Paid`
   - Property: `Goal` → Type: `Text`
   - Property: `Review Cadence` → Type: `Select` → Create enum `Review Cadence`: `Weekly`, `Monthly`, `Quarterly`

> Channel Strategy inherits Status, Owner, Last Reviewed from Base Document.

---

## TASK 7: Define 3 Relations

### Relation 1: Design Asset → Feature Spec (N:N)

1. Go to Settings → find `Design Asset` Type → open it
2. Find the "Relations" section
3. Click `+` to add a relation
4. Configure:
   - Target Type: `Feature Spec`
   - Relation name on Design Asset side: `visualizes`
   - Relation name on Feature Spec side: `designed with`
   - Relation type: `N:N` (many Design Assets can visualize many Feature Specs)

### Relation 2: Campaign Plan → Content Piece (1:N)

1. Go to Settings → find `Campaign Plan` Type → open it
2. Find the "Relations" section
3. Click `+` to add a relation
4. Configure:
   - Target Type: `Content Piece`
   - Relation name on Campaign Plan side: `contains`
   - Relation name on Content Piece side: `part of`
   - Relation type: `1:N` (one Campaign contains many Content Pieces)

### Relation 3: Campaign Plan → PRD (N:N)

1. Stay on `Campaign Plan` Type settings (or navigate back to it)
2. Find the "Relations" section
3. Click `+` to add another relation
4. Configure:
   - Target Type: `PRD`
   - Relation name on Campaign Plan side: `promotes`
   - Relation name on PRD side: `promoted by`
   - Relation type: `N:N` (many Campaigns can promote many PRDs)

---

## TASK 8: Create 2 New Spaces

Navigate to the Cards module (left sidebar → "Cards").

### Space 1: Design

1. Click `+ Create Space` (top-left area)
2. Enter name: `Design`
3. Select Types to include: `Design Asset`, `Design System Entry`, `Brand Guideline`
4. Set as Private
5. Configure owners/members as needed (designers, PM)
6. Click Create

### Space 2: Marketing

1. Click `+ Create Space`
2. Enter name: `Marketing`
3. Select Types to include: `Campaign Plan`, `Content Piece`, `Channel Strategy`
4. Set as Private
5. Configure owners/members as needed (marketing team, founders)
6. Click Create

---

## TASK 9: Create Verification Cards

### Card 1: Design Asset example

1. In Cards module, select `Design` space → `Design Asset` type
2. Click `+ Create Card`
3. Title: `Homepage Hero Mockup v2`
4. Set properties:
   - Asset Type: `UI Mockup`
   - Design Tool: `Figma`
   - Version: `2.0`
   - Status: `Approved`
   - Platform: `Web`
5. Verify: A file upload area should be visible on this card (inherited from File Type)
6. Add relation: `visualizes` → link to the existing Feature Spec card `[web] Add cloth size selection to cart` (created in Phase 1)

### Card 2: Design System Entry example

1. Select `Design` space → `Design System Entry` type
2. Click `+ Create Card`
3. Title: `Button`
4. Set properties:
   - Component Name: `Button`
   - Category: `Primitive`
   - Platform: `Web`
   - Status: `Stable`
   - Figma Link: (leave empty or enter a placeholder URL)
   - Code Path: `web/components/ui/button.tsx`

### Card 3: Brand Guideline example

1. Select `Design` space → `Brand Guideline` type
2. Click `+ Create Card`
3. Title: `Brand Color Palette`
4. Set properties:
   - Status: `Active` (inherited from Base Document)
   - Owner: `Jadyn`
   - Guideline Area: `Color`
   - Version: `1.0`

### Card 4: Campaign Plan example

1. Select `Marketing` space → `Campaign Plan` type
2. Click `+ Create Card`
3. Title: `2026-Q3: Summer Collection Launch`
4. Set properties:
   - Campaign Name: `Summer Collection Launch`
   - Status: `Planning`
   - Channel: `Instagram`, `TikTok`
   - Budget: `5000`
   - Start Date: `2026-07-01`
   - End Date: `2026-08-31`
   - Target Audience: `Gen Z`, `Young Professional`
   - KPI: `10K Instagram impressions, 500 TikTok shares`
5. Add relation: `promotes` → link to the existing PRD card `PRD: AI-powered outfit recommendations` (created in Phase 1)

### Card 5: Content Piece example

1. Select `Marketing` space → `Content Piece` type
2. Click `+ Create Card`
3. Title: `Summer Look Reveal Reel`
4. Set properties:
   - Content Type: `Video`
   - Platform: `TikTok`
   - Status: `Ideation`
   - Author: `Jadyn`
5. Add tag: `Priority` → set Priority Level to `P2 - Medium`
6. Add relation: Go to the `Campaign Plan` card created above → in its `contains` relation, link this Content Piece
   (Alternatively, on this Content Piece card, check if `part of` relation appears and link to the Campaign)

### Card 6: Channel Strategy example

1. Select `Marketing` space → `Channel Strategy` type
2. Click `+ Create Card`
3. Title: `Instagram Growth Strategy`
4. Set properties:
   - Status: `Active` (inherited from Base Document)
   - Owner: `Jadyn`
   - Channel: `Instagram`
   - Goal: `Grow to 5K followers by Q4 2026`
   - Review Cadence: `Monthly`

---

## TASK 10: Create 4 Saved Views

### View 1: Active Campaigns

1. In Cards module, navigate to `Marketing` space → `Campaign Plan` type
2. The table view should display all Campaign Plan cards
3. Click the "Filter" button
4. Add filter: `Status` = `Planning` OR `Active`
5. Click "Save as"
6. Enter name: `Active Campaigns`
7. Set visibility: Public
8. Verify: The saved view appears in the left sidebar

### View 2: Content Calendar

1. Navigate to `Marketing` space → `Content Piece` type
2. Click the "Filter" button
3. Add filter: `Status` is NOT `Published`
4. Sort by `Publish Date` ascending (click the column header if available)
5. Click "Save as"
6. Enter name: `Content Calendar`
7. Set visibility: Public

### View 3: Design Review Queue

1. Navigate to `Design` space → `Design Asset` type
2. Click the "Filter" button
3. Add filter: `Status` = `Ready for Review`
4. Click "Save as"
5. Enter name: `Design Review Queue`
6. Set visibility: Public

### View 4: Stable Components

1. Navigate to `Design` space → `Design System Entry` type
2. Click the "Filter" button
3. Add filter: `Status` = `Stable`
4. Click "Save as"
5. Enter name: `Stable Components`
6. Set visibility: Public

---

## COMPLETION CHECKLIST

After all tasks, verify:

### Types (6 new)
- [ ] `Design Asset` — derived from File Type (has file upload area)
- [ ] `Design System Entry` — independent top-level Type
- [ ] `Brand Guideline` — derived from Base Document (inherits Status, Owner, Last Reviewed)
- [ ] `Campaign Plan` — independent top-level Type
- [ ] `Content Piece` — independent top-level Type (has Priority tag)
- [ ] `Channel Strategy` — derived from Base Document (inherits Status, Owner, Last Reviewed)

### New Enums Created (14)
- [ ] Asset Type (6 options)
- [ ] Design Tool (5 options)
- [ ] Asset Status (4 options)
- [ ] Platform (3 options)
- [ ] Component Category (5 options)
- [ ] Component Status (3 options)
- [ ] Guideline Area (6 options)
- [ ] Campaign Status (5 options)
- [ ] Channel (7 options)
- [ ] Target Audience (3 options)
- [ ] Content Type (6 options)
- [ ] Content Platform (6 options)
- [ ] Content Status (5 options)
- [ ] Review Cadence (3 options)

### Relations (3 new)
- [ ] Design Asset ↔ Feature Spec: `visualizes` / `designed with` (N:N)
- [ ] Campaign Plan ↔ Content Piece: `contains` / `part of` (1:N)
- [ ] Campaign Plan ↔ PRD: `promotes` / `promoted by` (N:N)

### Spaces (2 new)
- [ ] `Design` (Private) — includes Design Asset, Design System Entry, Brand Guideline
- [ ] `Marketing` (Private) — includes Campaign Plan, Content Piece, Channel Strategy

### Verification Cards (6)
- [ ] `Homepage Hero Mockup v2` (Design Asset) — has file upload area, linked to Feature Spec
- [ ] `Button` (Design System Entry) — Code Path filled
- [ ] `Brand Color Palette` (Brand Guideline) — inherited Status = Active
- [ ] `2026-Q3: Summer Collection Launch` (Campaign Plan) — linked to PRD via `promotes`
- [ ] `Summer Look Reveal Reel` (Content Piece) — Priority tag applied, linked to Campaign
- [ ] `Instagram Growth Strategy` (Channel Strategy) — inherited Status = Active

### Saved Views (4)
- [ ] `Active Campaigns` — Campaign Plans with Planning or Active status
- [ ] `Content Calendar` — Content Pieces not yet Published, sorted by date
- [ ] `Design Review Queue` — Design Assets with Ready for Review status
- [ ] `Stable Components` — Design System Entries with Stable status

### Cross-Space Relations
- [ ] Campaign Plan (Marketing) → PRD (Product) cross-space link works
- [ ] Design Asset (Design) → Feature Spec (Engineering) cross-space link works
