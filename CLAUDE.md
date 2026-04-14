# Astrolog PWA — CLAUDE.md

## Project overview
A Progressive Web App for astronomy planning and logging, built for personal use by an amateur astronomer. The app covers session logging, target tracking, and star party (camping trip) checklist management. Deployed at **https://astrolog-pwa.vercel.app**.

## Tech stack
- **Framework**: Next.js 14 (App Router, `"use client"` pages)
- **Database / Auth**: Supabase (PostgreSQL + Row Level Security)
- **Styling**: Inline styles throughout — no Tailwind, no CSS modules
- **Deployment**: Vercel (auto-deploys from `main` branch on GitHub: `GrandPaClanger/astrolog-pwa`)
- **Auth**: Supabase Auth (Google OAuth + magic link email)

## Key conventions
- All pages use `export const dynamic = "force-dynamic"`
- Supabase client from `@/lib/supabase`
- `current_person_id()` returns `bigint` (not uuid) — `person_id` columns reference `public.person(person_id)`
- Inline styles use dark navy palette; active/accent colours: blue `#93c5fd`, green `#86efac`, amber `#fbbf24`, red `#f87171`
- Optimistic UI: remove from local state immediately, sync to DB, restore on error
- No Tailwind — never add it

---

## Star Party Checklist — feature area

The main active development area. Manages packing for astronomy camping trips.

### URL structure
```
/star-party                          — list of events
/star-party/events/new               — create event (with copy-from-previous option)
/star-party/events/[id]              — Required Items (main overview)
/star-party/events/[id]/pick         — To Pick list
/star-party/events/[id]/pack         — To Pack / packing into containers
/star-party/events/[id]/load         — To Load into car
/star-party/events/[id]/containers   — Manage Containers
/star-party/events/[id]/off-plan     — Items not on this plan
/star-party/events/[id]/print        — Printable packing list
/star-party/items                    — Master item list (add/edit/delete items)
```

### Status flow for plan items
```
to_pick → picked → packed (container_id set or null) → loaded = true
```
- `to_pick`: item is on the plan, not yet collected
- `picked`: item has been found/collected, ready to pack
- `packed`: item is packed — either into a named container (`container_id`) or loose (`container_id = null`)
- `loaded`: boolean flag, set true when container/item is loaded into the car

### Database tables (star party)

| Table | Key columns | Notes |
|---|---|---|
| `star_party_event` | event_id, name, date_from, date_to, is_current | One event = one trip |
| `star_party_category` | slug, label, sort_order | e.g. "camping", "astro" |
| `star_party_sub_category` | name, category (slug), sort_order | Belongs to a category |
| `star_party_item` | item_id, name, category (slug), sub_category, sort_order | Master item list |
| `star_party_plan_item` | plan_item_id, event_id, item_id, person_id, status, container_id, loaded | Per-event item instance |
| `star_party_container` | container_id, event_id, container_type_id, number, name, description, person_id | e.g. "Box 1", "Bag 2" |
| `star_party_container_type` | container_type_id, name, sort_order | "Box" (1), "Bag" (2) |

### Container logic
- Containers are created manually on the Pack page or Manage Containers page
- Container numbering: `number` field auto-increments per type per event (max+1), excluding any named "Loose"
- No auto-created containers — user creates all containers explicitly
- Loose packed items (`status='packed', container_id=null`) appear in a **Loose** card on the Pack page with full reassign/reset controls
- `description` column on `star_party_container` is optional free text (e.g. "Cooking equipment")

### Item grouping / sort order
Items on all event pages are grouped and sorted:
1. Category (by `sort_order` in `star_party_category`)
2. Sub-category (alphabetical)
3. Item name (alphabetical)

Categories are loaded dynamically from the DB — no hardcoded slugs.

### Key UI patterns
- **5-tab navigation** on all event pages: Required | To Pick | To Pack | To Load | Off Plan
- **Predictive search** on Required Items and To Pick pages: flat filtered list while typing, grouped view when empty
- **Chip rows** for container selection: existing containers shown as blue chips, `+ New Box` / `+ New Bag` as green dashed chips
- **Expandable cards** throughout: chevron `›` rotates 90° when open
- **Optimistic updates** with rollback on error
- **Scroll-to-edit** on the Items page: editing an item scrolls to the form; saving scrolls back to the item above the one that was edited

### Pages — current state

**Required Items** (`/events/[id]`)
- Shows all plan items grouped by category/sub-category
- Status badges: To Pick (amber), Picked (blue), Packed (green)
- Picked/Packed items have an undo button to revert status
- Packed items show container name as subtitle
- Search box filters flat list while typing
- Link to 🖨 Packing List print view

**To Pick** (`/events/[id]/pick`)
- Shows only `status='to_pick'` items
- Tap to mark as picked (optimistic, moves item out of list)
- Predictive search: flat list with category·sub-category subtitle

**To Pack** (`/events/[id]/pack`)
- **To Pack section**: picked items waiting to be packed; tap to expand chip row (all containers + `+ New Box/Bag`); ↩ returns to pick list
- **Containers section**: all containers shown as expandable cards; inside each: list of packed items (tap to reassign), `▼ Add items` panel to pack picked items directly into that container
- **Loose section**: appears if any `status='packed', container_id=null` items exist; each item has ↩ reset and a reassign chip row
- Link to Manage Containers →

**To Load** (`/events/[id]/load`)
- Container cards: tap header to expand item list (with ✓ loaded state), "Load into Car" / "Loaded ✓" toggle button
- Loose items section for `container_id=null` packed items
- Summary bar: X/Y items loaded
- "↩ Return all to pick list" inside each expanded container

**Manage Containers** (`/events/[id]/containers`)
- Create New: `+ New Box` / `+ New Bag` buttons
- Each container card: expandable, shows description field (auto-saves on blur), item list with Remove buttons, `▼ Add items` panel for picked items
- Rename (✏️) inline edit, Delete (🗑) enabled only when empty

**Off Plan** (`/events/[id]/off-plan`)
- Items from the master list NOT on this event's plan
- Grouped by category/sub-category
- Add button to add items to the plan

**Print** (`/events/[id]/print`)
- Grouped by container, then loose, then picked-not-packed, then to-pick
- `@media print` CSS for clean output

**Master Items** (`/star-party/items`)
- Add/edit/delete items
- Edit scrolls to form; save scrolls back to item above the edited one (blue left-border highlight)
- New sub-categories get correct sort_order (max+1)

---

## Other app sections (not actively developed)
- `/sessions` — astronomy observation session logging
- `/targets` — deep sky / target tracking
- `/focus-positions` — focuser position logging
- `/maintenance` — equipment maintenance log
- `/image-runs` — imaging run records
- `/flat-wizard` — flat frame calculator
