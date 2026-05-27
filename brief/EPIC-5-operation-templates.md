# Epic 5 — Operation Templates

## Goal

Let shops build a reusable library of operations (CNC Milling, Deburr, Bending, etc.) with default times and rates. On the estimate page, estimators pick from "Recently used" or "All" templates instead of typing from scratch each time.

## Screenshot references

- `4.49.* PM` — Template picker modal: "recently used" section + "all" section, searchable text input at top
- `9.58.31 PM` — Operations list showing Deburr, Bending with clock icons; dropdown showing "Expense (Operation)" / "CNC Milling" types

---

## Scope

### 5.1 — `operation_templates` table

```sql
CREATE TABLE operation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  operation_type TEXT NOT NULL DEFAULT 'machining',  -- 'machining' | 'expense'
  default_setup_minutes NUMERIC NOT NULL DEFAULT 0,
  default_run_minutes NUMERIC NOT NULL DEFAULT 0,
  default_hourly_rate_cents INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_operation_templates_org ON operation_templates(org_id);
```

### 5.2 — `templateService` (packages/services)

```typescript
templateService.findAll(orgId): Promise<OperationTemplate[]>  // all templates, recently-used first
templateService.create(orgId, input): Promise<OperationTemplate>
templateService.update(orgId, templateId, data): Promise<OperationTemplate | undefined>
templateService.delete(orgId, templateId): Promise<void>
templateService.recordUsage(orgId, templateId): Promise<void>  // increments usage_count, sets last_used_at
```

Sort order for `findAll`: `last_used_at DESC NULLS LAST, name ASC`. This naturally gives "recently used" at the top.

### 5.3 — Estimate page template picker

Replace the "Add operation" plain text input with a two-phase UX:

**Phase 1 — template picker** (default): A `<select>` dropdown that lists templates. Options:
- First group (optgroup label "Zuletzt verwendet" / "Recently used"): top 5 by last_used_at
- Second group (optgroup label "Alle" / "All"): remaining templates alphabetically
- Last option: "— Manuell eingeben / Enter manually —"

When a template is selected, its values pre-fill the hidden fields (name, operationType, setupMinutes, runMinutes, hourlyRateCents). The submit button is always visible.

When "Enter manually" is selected, show the plain text inputs (same layout as Epic 4).

**Implementation**: Keep it server-component friendly — the template data is passed as a prop from the server component. The pre-fill logic is a small client component `OperationTemplateSelect`.

### 5.4 — Settings > Operation Templates page

Route: `/{orgSlug}/settings/operation-templates`

Shows a list of all org templates in a table: Name | Type | Setup | Run | Rate | Usage | Actions.
Inline "Add template" form at the top. Each row has a Delete button.

Add a nav link for "Operation templates" in the settings sidebar layout.

### 5.5 — i18n keys

```json
// settings namespace additions
"operation_templates": {
  "title": "Arbeitsgangvorlagen",
  "subtitle": "Wiederverwendbare Vorlagen für häufige Arbeitsgänge.",
  "add": "Vorlage hinzufügen",
  "name": "Name",
  "type": "Typ",
  "setup": "Rüstzeit (min)",
  "run": "Laufzeit (min)",
  "rate": "Stundensatz (€)",
  "usage": "Verwendet",
  "empty": "Noch keine Vorlagen.",
  "delete": "Löschen"
},

// estimate namespace additions
"pick_template": "Vorlage wählen",
"template_recently_used": "Zuletzt verwendet",
"template_all": "Alle",
"template_manual": "— Manuell eingeben —",
"no_templates": "Keine Vorlagen vorhanden."
```

---

## DB changes

Generate migration: new `operation_templates` table only.

---

## Acceptance criteria

1. Settings > Operation Templates page: add/delete templates, usage count visible
2. Estimate page: template picker dropdown shows recently-used + all groups
3. Selecting a template pre-fills add-operation form; submitting records usage
4. Manual entry fallback works as before
5. `pnpm typecheck && pnpm lint` pass clean
