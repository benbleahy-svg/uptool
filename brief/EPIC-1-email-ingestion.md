# Epic 1 — Email Ingestion & RFQ Dashboard

**Project:** Uptool DACH
**PRD version:** v0.8
**Epic owner:** Product
**Engineer:** Claude Code
**Depends on:** Epic 0 complete and running

---

## Goal

A shop connects their RFQ inbox (Microsoft Outlook or Gmail), and inbound emails with manufacturing attachments automatically appear as RFQs in the dashboard. End state: a shop owner can connect their email, see incoming RFQs in a live table at `/{slug}/rfqs`, click into an RFQ to see the email thread and attachments, and manage a block list to filter noise. **No estimating, no quoting, no AI in this epic.**

## Out of scope (explicitly)

- Estimating / pricing (Epic 2)
- AI extraction of part details (Epic 3)
- CAD viewer (Epic 4)
- Sending quote emails (Epic 2)
- Manual RFQ creation (Epic 2)
- Inbound forwarding address (i.e. "forward your RFQ emails to rfq@uptool.com") — connect OAuth only
- IMAP for non-Google/Microsoft providers
- QuickBooks integration
- Customer portal

---

## How to use this brief with Claude Code

1. Paste this entire document as your first message to a fresh Claude Code session.
2. Tell the agent: *"Read CLAUDE.md and this brief in full before doing anything. List clarifying questions before writing any code."*
3. Work through phases in order. Accept criteria at §13 must all pass before the epic is done.
4. Every unspecified decision goes in `docs/decisions/` as an ADR (continue numbering from 0005).

---

## 1. Stack additions for Epic 1

| Addition | Choice | Notes |
|---|---|---|
| Data table | TanStack Table v8 | `@tanstack/react-table` — headless, we own the markup |
| S3-compatible client | `@aws-sdk/client-s3` | Works against Minio locally and any S3-compatible in prod |
| Local file storage (dev) | Minio | Add to `docker-compose.yml` |
| Microsoft Graph client | `@microsoft/microsoft-graph-client` | Official SDK |
| Gmail client | `googleapis` | Official Google API Node.js client |
| Date library | `date-fns` | Formatting dates in table + thread view |

Do **not** introduce: axios, nodemailer, imapflow, or any IMAP library. Use provider REST APIs only.

---

## 2. Database schema additions

Add a new Drizzle migration for these tables. All tables with `org_id` get RLS (`tenant_isolation` policy — same pattern as Epic 0).

### 2.1 email_accounts

```sql
create table email_accounts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  provider        text not null check (provider in ('microsoft', 'gmail')),
  email           text not null,
  display_name    text,
  access_token    text,              -- store encrypted; see §2.8
  refresh_token   text,
  token_expires_at timestamptz,
  last_checked_at timestamptz,
  status          text not null default 'connected'
                  check (status in ('connected', 'error', 'disconnected')),
  error_message   text,
  created_at      timestamptz not null default now(),
  unique (org_id, email)
);
```

RLS: enable + `tenant_isolation` policy on `org_id`.

### 2.2 customers

```sql
create table customers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  name        text not null,
  domain      text,                -- e.g. 'tesla.com' — used for matching
  created_at  timestamptz not null default now()
);
```

RLS: enable + `tenant_isolation` policy.

### 2.3 contacts

```sql
create table contacts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  email       text not null,
  name        text,
  created_at  timestamptz not null default now(),
  unique (org_id, email)
);
```

RLS: enable + `tenant_isolation` policy.

### 2.4 rfqs

```sql
create table rfqs (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references orgs(id) on delete cascade,
  rfq_number         integer not null,   -- sequential per org; see §5.3
  customer_id        uuid references customers(id) on delete set null,
  contact_id         uuid references contacts(id) on delete set null,
  email_account_id   uuid references email_accounts(id) on delete set null,
  subject            text,
  status             text not null default 'new'
                     check (status in ('new','estimated','quoted','sent','won','lost','no_bid')),
  assignee_id        uuid references users(id) on delete set null,
  received_at        timestamptz not null,
  last_email_at      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, rfq_number)
);
```

RLS: enable + `tenant_isolation` policy.

### 2.5 email_threads

```sql
create table email_threads (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  rfq_id        uuid not null references rfqs(id) on delete cascade,
  provider_thread_id text not null,  -- MS conversationId or Gmail threadId
  provider      text not null check (provider in ('microsoft', 'gmail')),
  created_at    timestamptz not null default now(),
  unique (org_id, provider_thread_id, provider)
);
```

RLS: enable + `tenant_isolation` policy.

### 2.6 email_messages

```sql
create table email_messages (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id) on delete cascade,
  thread_id      uuid not null references email_threads(id) on delete cascade,
  provider_message_id text not null,
  direction      text not null check (direction in ('inbound','outbound')),
  from_email     text,
  from_name      text,
  to_emails      text[],
  subject        text,
  body_text      text,
  body_html      text,
  received_at    timestamptz not null,
  created_at     timestamptz not null default now(),
  unique (org_id, provider_message_id)
);
```

RLS: enable + `tenant_isolation` policy.

### 2.7 attachments

```sql
create table attachments (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  rfq_id        uuid references rfqs(id) on delete cascade,
  message_id    uuid references email_messages(id) on delete cascade,
  filename      text not null,
  content_type  text not null,
  size_bytes    integer,
  storage_key   text not null,      -- path in S3/Minio bucket
  created_at    timestamptz not null default now()
);
```

RLS: enable + `tenant_isolation` policy.

### 2.8 block_list

```sql
create table block_list (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  value      text not null,          -- full email OR @domain.com (with leading @)
  created_at timestamptz not null default now(),
  unique (org_id, value)
);
```

RLS: enable + `tenant_isolation` policy.

### 2.9 Indexes

```sql
create index idx_rfqs_org_status      on rfqs(org_id, status);
create index idx_rfqs_org_received    on rfqs(org_id, received_at desc);
create index idx_email_threads_rfq    on email_threads(rfq_id);
create index idx_email_messages_thread on email_messages(thread_id, received_at desc);
create index idx_attachments_rfq      on attachments(rfq_id);
create index idx_contacts_org_email   on contacts(org_id, email);
create index idx_customers_org_domain on customers(org_id, domain);
create index idx_block_list_org       on block_list(org_id);
create index idx_email_accounts_org   on email_accounts(org_id);
```

### 2.10 Token encryption

`access_token` and `refresh_token` in `email_accounts` must be encrypted at rest. Use AES-256-GCM with `ENCRYPTION_KEY` env var (32-byte base64 key). Implement an `encrypt(plaintext)` / `decrypt(ciphertext)` utility in `packages/shared/src/crypto.ts`. Store as `iv:ciphertext` (both hex-encoded). Add `ENCRYPTION_KEY` to `.env.example`.

### 2.11 RFQ auto-number sequence

Use a Postgres sequence per org. Implement `nextRfqNumber(orgId)` in the services layer: `SELECT nextval('rfq_seq_' || org_id_short)`. **Simpler alternative (use this):** Keep a counter column in `orgs` table (`rfq_counter integer not null default 0`) and use `UPDATE orgs SET rfq_counter = rfq_counter + 1 WHERE id = $1 RETURNING rfq_counter` inside the same transaction as the RFQ insert. Document this choice as an ADR.

---

## 3. File storage

### 3.1 Local dev — Minio

Add to `docker-compose.yml`:

```yaml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  ports:
    - "9000:9000"
    - "9001:9001"    # Minio console at http://localhost:9001
  environment:
    MINIO_ROOT_USER: uptool
    MINIO_ROOT_PASSWORD: uptool123
  volumes:
    - minio_data:/data

volumes:
  minio_data:
```

Add to `.env.example`:

```
S3_ENDPOINT="http://localhost:9000"
S3_BUCKET="uptool-attachments"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="uptool"
S3_SECRET_ACCESS_KEY="uptool123"
S3_PUBLIC_URL=""    # Leave blank for presigned URLs; set to CDN URL in prod
```

### 3.2 Storage service

`packages/services/src/storage.ts` — `storageService`:

```typescript
storageService.upload(key: string, body: Buffer, contentType: string): Promise<void>
storageService.presignedUrl(key: string, expiresInSeconds: number): Promise<string>
storageService.delete(key: string): Promise<void>
```

Key format: `{orgId}/{rfqId}/{filename}` (ensures RLS-like partitioning even in S3).

### 3.3 Bucket init

Add a `pnpm storage:init` script in `packages/db/package.json` that creates the bucket if it doesn't exist. Run this as part of local dev setup.

---

## 4. Email account connection (OAuth)

### 4.1 Microsoft Outlook — MS Graph API

**OAuth scopes:** `Mail.Read Mail.Send offline_access User.Read`

**Flow:**

1. User clicks "Add Account" → "Microsoft" on Settings > Email Accounts page.
2. Server action generates the MS OAuth authorization URL with state param (signed JWT containing `orgId` + random nonce).
3. User is redirected to Microsoft.
4. Callback lands at `GET /api/email-accounts/callback/microsoft?code=...&state=...`.
5. Exchange code for tokens. Call `/me` to get email + display name.
6. Store encrypted tokens in `email_accounts`.
7. Enqueue `PollEmailAccount` job for immediate first poll.
8. Redirect to `/[orgSlug]/settings/email-accounts` with success toast.

**Env vars:**

```
AUTH_MICROSOFT_ENTRA_ID_ID=         # same client_id used for auth login
AUTH_MICROSOFT_ENTRA_ID_SECRET=     # same client_secret
MICROSOFT_GRAPH_REDIRECT_URI=http://localhost:3000/api/email-accounts/callback/microsoft
```

**Note:** Reuse the same Azure app registration as the Microsoft sign-in provider. Add the callback URI to the Azure app's redirect URIs. Add `Mail.Read`, `Mail.Send` to the app's API permissions (requires admin consent for org tenants — surface the admin consent URL in the settings UI).

### 4.2 Gmail — Google API

**OAuth scopes:** `https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send`

**Flow:** Same pattern as Microsoft. Callback at `GET /api/email-accounts/callback/gmail`.

**Env vars:**

```
GOOGLE_CLIENT_ID=          # same as AUTH_GOOGLE_ID
GOOGLE_CLIENT_SECRET=      # same as AUTH_GOOGLE_SECRET
GOOGLE_GMAIL_REDIRECT_URI=http://localhost:3000/api/email-accounts/callback/gmail
```

**Note:** Reuse the same Google OAuth app as sign-in. Add the Gmail scopes and the new redirect URI.

### 4.3 Token refresh

Before each API call, check `token_expires_at`. If within 5 minutes of expiry, refresh using the stored `refresh_token` and update the DB. Implement `refreshMicrosoftToken` and `refreshGmailToken` in `packages/services/src/email-token.ts`.

### 4.4 Disconnect

"Remove Email Account" button on the settings page soft-deletes the `email_accounts` row (set `status = 'disconnected'`). Does not delete historical data.

---

## 5. Email polling (BullMQ)

### 5.1 PollEmailAccount job

**Queue name:** `poll-email-account`
**Job data:** `{ emailAccountId: string, orgId: string }`

**Trigger:**
- On account connect: enqueue immediately.
- Recurring: a scheduler runs every 5 minutes and enqueues one job per `status = 'connected'` account. Use BullMQ's `QueueScheduler` + repeatable jobs — **one repeatable job per account**, not a global cron. Key: `poll:${emailAccountId}`.

**Processor logic (`apps/worker/src/processors/poll-email-account.ts`):**

1. Load account from DB, decrypt tokens, refresh if needed.
2. Fetch messages since `last_checked_at` (or last 7 days if first poll).
   - **Microsoft:** `GET /me/mailFolders/inbox/messages?$filter=receivedDateTime ge {iso}&$expand=attachments` via MS Graph.
   - **Gmail:** `gmail.users.messages.list` with `q: 'after:{epoch} in:inbox'`, then fetch each message with `format: FULL`.
3. For each message, enqueue an `IngestEmail` job.
4. Update `email_accounts.last_checked_at = now()`.
5. On error: set `status = 'error'`, `error_message = err.message`.

**Concurrency:** 5 parallel `poll-email-account` workers.

### 5.2 IngestEmail job

**Queue name:** `ingest-email`
**Job data:** `{ emailAccountId: string, orgId: string, providerMessageId: string }`

**Processor logic (`apps/worker/src/processors/ingest-email.ts`):**

1. Check idempotency: if `email_messages` row with `provider_message_id` already exists → skip.
2. Fetch full message body + attachments from provider API.
3. Check block list: if `from_email` address OR `@domain` is in `block_list` for this org → skip.
4. Classify email:
   - If `provider_thread_id` matches an existing `email_threads` row → add message to existing thread, update `rfqs.last_email_at`, skip RFQ creation.
   - If no existing thread AND at least one attachment with a manufacturing extension → create new RFQ (see §5.3).
   - If no existing thread AND no qualifying attachments → skip (not an RFQ).
5. Store attachments in S3 under `{orgId}/{rfqId}/{filename}`.
6. Insert `attachments` rows.

**Manufacturing file extensions:** `.pdf`, `.dxf`, `.dwg`, `.step`, `.stp`, `.iges`, `.igs`, `.stl`, `.3mf`

Define this list as a constant in `packages/shared/src/constants.ts`.

**Concurrency:** 10 parallel `ingest-email` workers.

### 5.3 RFQ creation (inside IngestEmail)

Run inside a single `withOrgContext` transaction:

1. Parse sender: extract `from_email`, `from_name` from message headers.
2. Customer matching: look up `contacts` by `(org_id, from_email)`. If found, use `contact.customer_id`. If not found, create contact (and customer if domain not in `customers` for this org — strip local part, use domain from email address).
3. Increment `orgs.rfq_counter`, use returned value as `rfq_number`.
4. Insert `rfqs` row.
5. Insert `email_threads` row.
6. Insert `email_messages` row.
7. Download each qualifying attachment from provider API, upload to S3, insert `attachments` rows.
8. Insert `audit_log` entry: `entity='rfq', action='created', entity_id=rfqId`.

**Customer matching rules:**

- Exact email match in `contacts` → use existing contact + customer.
- No match: create contact. Check if any customer in org has `domain = emailDomain(from_email)`. If yes, link to it. If no, create new customer with `name = emailDomain(from_email)` (user can rename later).

---

## 6. RFQ dashboard (`/{slug}/rfqs`)

### 6.1 Data fetching

Server component fetches the first page (50 rows) of RFQs sorted by `received_at desc`. Subsequent sorts/filters are client-side via TanStack Table (client-side over 50 rows is fine at MVP scale — add server-side pagination in a later epic if needed).

Load: `rfqs JOIN customers JOIN contacts JOIN attachments` — enough to populate all visible columns. Use `withOrgContext`.

### 6.2 Table columns

Exact match of the reference UI:

| Column | Content | Sortable |
|---|---|---|
| RFQ | `#{rfq_number}` | Yes (default desc) |
| Company | `customer.name` | Yes |
| Contact | `contact.name` | No |
| Parts | File-type icon strip (one icon per unique extension among attachments) | No |
| Status | Coloured badge | Yes |
| Date Received | Relative (`14 days ago`) + absolute on hover | Yes |
| Last Email | Relative, blank if none | Yes |
| Assignee | User name or unassigned dropdown | No |

### 6.3 Status badges

Use the status colours from the design tokens. Map:

| Status | Visual |
|---|---|
| `new` | Grey pill |
| `estimated` | Blue pill (--primary) |
| `quoted` | Blue pill with filled segments |
| `sent` | Blue pill — full |
| `won` | Green (--status-success) |
| `lost` | Grey |
| `no_bid` | Grey, strikethrough label |

The badge shows 3 small segment rectangles (matching the reference screenshot) that fill left-to-right as the status progresses through: new → estimated → quoted → sent. Won/lost are terminal states shown differently.

### 6.4 File type icons

Render a small icon per unique file extension in the RFQ's attachments. Use Lucide icons or simple coloured squares with a 2-3 letter label (e.g. "DXF", "PDF", "STP"). Stack them horizontally with a max of 5 visible + "+N" overflow badge.

### 6.5 Interactions

- Row click → navigate to `/{slug}/rfqs/{rfqId}`.
- Column header click → sort (client-side).
- Assignee dropdown per row → updates `rfqs.assignee_id` via server action (optimistic UI).
- No row selection or bulk actions in Epic 1.

### 6.6 Empty state

When no RFQs exist (no email account connected): show the existing "No RFQs yet" empty state from Epic 0, but add a CTA button: "Connect your inbox →" that links to `/{slug}/settings/email-accounts`.

When email account is connected but no RFQs yet: "Waiting for your first RFQ. Emails with manufacturing attachments will appear here automatically."

### 6.7 Real-time refresh

No WebSocket in Epic 1. Add a simple 30-second polling refresh using `router.refresh()` inside a `useEffect` in the table's client wrapper. This gives near-live feel without infra complexity.

---

## 7. RFQ detail page (`/{slug}/rfqs/{rfqId}`)

**Layout:** Two-panel. Left sidebar (fixed 280px). Right: main content.

### 7.1 Left sidebar

```
[RFQ #{number}]        ← header

[Customer name]        ← editable (click to edit) — Epic 2
  Contact name         ← editable — Epic 2
  contact@email.com

[Revision 1 ▾] [Create New RFQ]   ← revision selector and new-revision button — Epic 2

─────────────────
✉ Messaging            ← scrolls to thread view
⊕ Timeline             ← scrolls to timeline section
─────────────────
● Estimate             ← workflow stage (active stage highlighted)
  ↳ Part 1 filename
  ↳ Part 2 filename
○ Quote                ← greyed out in Epic 1
○ Send                 ← greyed out in Epic 1
```

In Epic 1: Estimate stage is always active (or "new" before work starts). Quote and Send stages are rendered greyed out — non-interactive.

### 7.2 Main content — email thread

Show email messages in chronological order (oldest first). For each message:

- Sender name + email, timestamp (formatted by locale)
- Subject (only on first message)
- Body text (render `body_text`; do not render `body_html` — security risk — use text only in Epic 1)
- Attachment list: filename, size, download link (presigned S3 URL, 1-hour expiry)

Compose/reply area: placeholder only in Epic 1 — render the composer shell (To, text area, Send button) but have the Send button show a toast "Sending quotes is coming in Epic 2." No actual send logic.

### 7.3 Timeline section

Below the thread. Simple vertical timeline showing:
- RFQ created (with timestamp and "via {emailAccountEmail}")
- Each message received/sent (timestamp + direction)

No filtering or pagination needed in Epic 1.

---

## 8. Settings — Email Accounts (`/{slug}/settings/email-accounts`)

Match the reference UI (Screenshot 1.31.55 PM).

### 8.1 Layout

Under `/{slug}/settings/` — add a settings layout with a left nav (General, Users, Email Accounts — other items greyed out/coming soon).

### 8.2 Email accounts list

For each connected account, show:
- Provider logo (Microsoft / Gmail icon)
- Email address
- Last checked: "{relative time}" (or "Never")
- Status: "✓ Connected" (green) or "✗ Error: {message}" (red)
- Authorizing User: name + org-slug of the member who connected it
- "Remove Email Account" button (destructive confirm dialog)

### 8.3 Add account

"Add Account" button opens a dropdown: "Microsoft Outlook" / "Gmail". Each triggers the respective OAuth flow (§4).

### 8.4 Microsoft Admin Consent

Show a section below the accounts list:

> *"If your organisation requires admin approval for third-party apps, send your IT administrator this link to grant access:"*

Render the MS admin consent URL: `https://login.microsoftonline.com/organizations/adminconsent?client_id={clientId}&redirect_uri={redirectUri}` as a copyable text field.

### 8.5 Block list

At the bottom of the same page:

> *"Always ignore emails from the following addresses or domains. To block a whole domain, omit the local part (e.g. @apple.com)."*

- List current block list entries with a delete (trash) icon per entry.
- "Add Email Address or Domain" input + Add button. Validates format: either a valid email address OR a string starting with `@` followed by a valid domain.
- Server action: `addBlockListEntry(orgId, value)`, `removeBlockListEntry(orgId, id)`.

---

## 9. i18n additions

Add to both `de.json` and `en-GB.json`. Translate properly — do not placeholder.

```
rfqs.page_title              = "RFQ Dashboard" / "Anfragen-Übersicht"
rfqs.search_placeholder      = "Search RFQs…" / "Anfragen suchen…"
rfqs.empty.no_account.title  = "Connect your inbox" / "Postfach verbinden"
rfqs.empty.no_account.body   = "Connect a Microsoft or Gmail account to start receiving RFQs automatically." / "Verbinden Sie ein Microsoft- oder Gmail-Konto, um Anfragen automatisch zu empfangen."
rfqs.empty.waiting.title     = "Waiting for your first RFQ" / "Warte auf erste Anfrage"
rfqs.empty.waiting.body      = "Emails with manufacturing attachments will appear here automatically." / "E-Mails mit Fertigungsanhängen erscheinen hier automatisch."
rfqs.col.rfq                 = "RFQ" / "Anfrage"
rfqs.col.company             = "Company" / "Unternehmen"
rfqs.col.contact             = "Contact" / "Kontakt"
rfqs.col.parts               = "Parts" / "Teile"
rfqs.col.status              = "Status" / "Status"
rfqs.col.received             = "Date Received" / "Eingangsdatum"
rfqs.col.last_email          = "Last Email" / "Letzte E-Mail"
rfqs.col.assignee            = "Assignee" / "Bearbeiter"
rfqs.status.new              = "New" / "Neu"
rfqs.status.estimated        = "Estimated" / "Kalkuliert"
rfqs.status.quoted           = "Quote Created" / "Angebot erstellt"
rfqs.status.sent             = "Quote Sent" / "Angebot gesendet"
rfqs.status.won              = "Won" / "Gewonnen"
rfqs.status.lost             = "Lost" / "Verloren"
rfqs.status.no_bid           = "No Bid" / "Kein Angebot"
rfq.messaging                = "Messaging" / "Nachrichten"
rfq.timeline                 = "Timeline" / "Verlauf"
rfq.revision                 = "Revision {n}" / "Version {n}"
rfq.create_new               = "Create New RFQ" / "Neue Anfrage"
rfq.estimate_stage           = "Estimate" / "Kalkulation"
rfq.quote_stage              = "Quote" / "Angebot"
rfq.send_stage               = "Send" / "Versand"
rfq.attachments              = "Attachments" / "Anhänge"
rfq.download                 = "Download" / "Herunterladen"
rfq.reply_placeholder        = "Sending quotes is coming soon." / "Angebot-Versand folgt in Kürze."
settings.email_accounts.title       = "Email Accounts" / "E-Mail-Konten"
settings.email_accounts.add         = "Add Account" / "Konto hinzufügen"
settings.email_accounts.last_checked = "Last checked" / "Zuletzt geprüft"
settings.email_accounts.status_ok   = "Connected" / "Verbunden"
settings.email_accounts.status_err  = "Error" / "Fehler"
settings.email_accounts.remove      = "Remove Email Account" / "E-Mail-Konto entfernen"
settings.email_accounts.authorizing_user = "Authorizing User" / "Autorisierender Benutzer"
settings.admin_consent.title        = "Microsoft Admin Consent" / "Microsoft-Administratorzustimmung"
settings.admin_consent.body         = "If your organisation requires admin approval, share this link with your IT administrator:" / "Wenn Ihre Organisation eine Administratorgenehmigung benötigt, senden Sie diesen Link an Ihren IT-Administrator:"
settings.block_list.title           = "Block List" / "Sperrliste"
settings.block_list.description     = "Always ignore emails from the following addresses or domains." / "E-Mails von folgenden Adressen oder Domains werden immer ignoriert."
settings.block_list.add             = "Add Email Address or Domain" / "E-Mail-Adresse oder Domain hinzufügen"
settings.block_list.add_button      = "Add" / "Hinzufügen"
```

---

## 10. New environment variables

Add to `.env.example`:

```bash
# File storage (Minio locally, S3-compatible in prod)
S3_ENDPOINT="http://localhost:9000"
S3_BUCKET="uptool-attachments"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="uptool"
S3_SECRET_ACCESS_KEY="uptool123"
S3_PUBLIC_URL=""

# Token encryption (run: openssl rand -base64 32)
ENCRYPTION_KEY=""

# Microsoft email OAuth (add Mail.Read, Mail.Send to existing Azure app)
MICROSOFT_GRAPH_REDIRECT_URI="http://localhost:3000/api/email-accounts/callback/microsoft"

# Google email OAuth (add Gmail scopes to existing Google OAuth app)
GOOGLE_GMAIL_REDIRECT_URI="http://localhost:3000/api/email-accounts/callback/gmail"
```

---

## 11. Services layer additions

All in `packages/services/src/`. No `next/*` imports.

| File | Exports |
|---|---|
| `email-account.ts` | `emailAccountService.create`, `.findByOrg`, `.updateStatus`, `.updateTokens`, `.softDelete` |
| `email-ingest.ts` | `emailIngestService.ingestMessage(payload)` — core ingest logic called by worker |
| `customer.ts` | `customerService.findOrCreate({ orgId, fromEmail, fromName })` |
| `rfq.ts` | `rfqService.create`, `.findByOrg`, `.findById`, `.updateAssignee` |
| `block-list.ts` | `blockListService.add`, `.remove`, `.findByOrg`, `.isBlocked(orgId, email)` |
| `storage.ts` | `storageService.upload`, `.presignedUrl`, `.delete` |
| `email-token.ts` | `refreshMicrosoftToken`, `refreshGmailToken` |

---

## 12. ADRs to write

| # | Topic |
|---|---|
| 0006 | S3-compatible storage with Minio for local dev |
| 0007 | RFQ auto-numbering via counter column on orgs (vs Postgres sequence) |
| 0008 | Polling vs webhooks for email (why polling first: simpler, no public URL needed in dev) |
| 0009 | Gmail API vs IMAP (REST API only — avoids IMAP library complexity) |
| 0010 | AES-256-GCM for OAuth token encryption at rest |

---

## 13. Acceptance criteria — Epic 1 is complete when

A reviewer can:

1. Run `docker compose up -d` (now includes Minio) and `pnpm dev` cleanly.
2. Navigate to `/{slug}/settings/email-accounts` and see the "Add Account" button for Microsoft and Gmail.
3. Connect a test Gmail account via OAuth; see it listed as "Connected" with "Last checked: a few seconds ago."
4. Send an email to that Gmail inbox from another address, with a `.pdf` and a `.step` attachment. Within 10 minutes (next poll cycle), an RFQ appears in the `/{slug}/rfqs` dashboard with the correct company name, contact, file icons, and status "New".
5. Click the RFQ row and see the detail page: left sidebar with RFQ number, customer, contact; email thread showing the inbound message body and attachment links; timeline showing "RFQ created via {email}".
6. Click an attachment download link and receive the file (served via presigned S3 URL).
7. Add an email address to the block list. Send another email from that address. Confirm no new RFQ is created.
8. Send a second email from the same address as AC#4 (a reply thread). Confirm no new RFQ is created — it appears as a new message in the existing RFQ's thread and `last_email_at` updates.
9. Disconnect the email account; confirm the "Remove" flow works and the account no longer appears as connected.
10. Run `pnpm typecheck && pnpm lint && pnpm test` — all pass.
11. Confirm `packages/services/` contains no `next/*`, `next-auth/*`, or `react` imports — CI grep passes.
12. Verify RLS: direct Postgres query `SELECT * FROM rfqs` without `SET app.org_id` returns 0 rows.

---

## 14. What Epic 2 will need from Epic 1

Epic 2 (Estimation) will add:
- `estimates`, `line_items`, `operations`, `materials` tables
- The estimation UI on the RFQ detail page (left panel with operations + costs, right panel with PDF viewer)
- CNC / Sheet Metal workflow templates
- Manual RFQ creation

Epic 1 must leave the RFQ detail page structured so that the estimate panel can be added to the left side and a file viewer can be added to the right without restructuring the layout.

The `parts` and `part_files` tables are defined in Epic 1's schema but **not yet populated** (Epic 1 stores attachments; mapping attachments → parts is done by AI extraction in Epic 3 or manually in Epic 2). Do not block ingestion on part resolution.

---

## 15. Anti-patterns — explicitly do not

- Do not use IMAP/SMTP libraries (`imapflow`, `nodemailer`). Use provider REST APIs.
- Do not store raw OAuth tokens unencrypted in the database.
- Do not render `body_html` from inbound emails — XSS risk. Render `body_text` only.
- Do not put email polling logic in a Next.js route handler. It lives in the BullMQ worker.
- Do not skip RLS on the new tables. The `tenant_isolation` policy applies to every table with `org_id`.
- Do not block ingestion on perfect customer matching. Create a stub customer if none exists; let the estimator fix it later.
- Do not add estimating UI, pricing, or AI in this epic. Those are Epic 2 and 3.

---

**End of Epic 1 brief.**
