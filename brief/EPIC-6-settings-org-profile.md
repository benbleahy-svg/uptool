# Epic 6 — Settings: Block List, Shop Profile & Assignee

## Goal

Fill in remaining settings pages (block list already has a service; shop profile is missing entirely) and add an assignee picker to the RFQ detail header.

## Scope

### 6.1 — Block list settings page

Route: `/{orgSlug}/settings/block-list`

Service (`blockListService`) is already complete. Just need:
- Page: list of blocked entries + add form (email or @domain.com)
- Server actions: `addBlockEntry`, `removeBlockEntry`
- i18n keys already exist in `settings.block_list`

### 6.2 — Shop profile settings page

Route: `/{orgSlug}/settings/shop`

DB changes:
- Add `default_hourly_rate_cents integer NOT NULL DEFAULT 0` to `orgs`
- Add `phone text`, `website text` to `orgs`
- `address_jsonb` already exists — store as `{ street: string, city: string, postal: string, country: string }`

`orgService.updateProfile(orgId, data)` — updates name, phone, website, addressJsonb, defaultHourlyRateCents.

Page: form with fields for shop name, phone, website, street, city, postal, country, default hourly rate. Saves via server action.

**Estimate page**: read `org.defaultHourlyRateCents` and pass as default to the operation rate input (replaces hardcoded 120).

**Quote PDF**: show org phone + address in footer.

### 6.3 — Assignee picker on RFQ detail

In `apps/web/app/[orgSlug]/rfqs/[rfqId]/layout.tsx`:
- Fetch all org members (users) in the layout
- Add a small `AssigneePicker` client component next to the status badge
- Selecting a user calls `updateAssignee` server action (already in `rfqService`)

`AssigneePicker` renders a `<select>` showing member names. On change, submits a hidden form. Needs a `useTransition` to not block UI.

### 6.4 — i18n additions

```json
// settings namespace
"shop": {
  "title": "Shop-Profil",
  "subtitle": "Informationen, die auf Angeboten erscheinen.",
  "name": "Werkstattname",
  "phone": "Telefon",
  "website": "Website",
  "street": "Straße",
  "city": "Stadt",
  "postal": "PLZ",
  "country": "Land",
  "default_rate": "Standard-Stundensatz (€/h)",
  "save": "Speichern"
}
```

### 6.5 — Settings nav

Add "Shop" and "Block List" links to `settings/layout.tsx`. (Block List link already added in Epic 5 — just need the page.)

## Acceptance criteria

1. Block list page: add/remove entries, page loads without error
2. Shop settings page: form saves to DB; quote PDF footer shows updated address/phone
3. Estimate add-operation form defaults to org's hourly rate (not hardcoded 120)
4. Assignee picker on RFQ detail: selecting a user updates rfq.assigneeId and reflects in the table
5. `pnpm typecheck && pnpm lint` pass clean
