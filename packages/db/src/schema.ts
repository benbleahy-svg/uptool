import { relations } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Auth.js v5 required tables
export const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
});

export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const authVerificationTokens = pgTable(
  "auth_verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ─── App tables ───────────────────────────────────────────────────────────────

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  country: text("country").notNull(),
  localeDefault: text("locale_default").notNull().default("de"),
  timezone: text("timezone").notNull().default("Europe/Berlin"),
  vatId: text("vat_id"),
  handelsregisterNr: text("handelsregister_nr"),
  addressJsonb: jsonb("address_jsonb"),
  phone: text("phone"),
  website: text("website"),
  defaultHourlyRateCents: integer("default_hourly_rate_cents").notNull().default(0),
  logoUrl: text("logo_url"),
  forwardingAddress: text("forwarding_address"),
  rfqCounter: integer("rfq_counter").notNull().default(1000),
  quoteCounter: integer("quote_counter").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  locale: text("locale").notNull().default("de"),
  imageUrl: text("image_url"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const membershipRoleEnum = pgEnum("membership_role", ["owner", "estimator", "office"]);

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index("idx_memberships_user").on(t.userId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    diffJsonb: jsonb("diff_jsonb"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_audit_log_org_entity").on(t.orgId, t.entity, t.entityId)],
);

export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputHash: text("input_hash").notNull(),
    outputJsonb: jsonb("output_jsonb"),
    latencyMs: integer("latency_ms"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_ai_runs_org_created").on(t.orgId, t.createdAt)],
);

// ─── Epic 1: Email ingestion tables ──────────────────────────────────────────

export const emailAccounts = pgTable(
  "email_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'microsoft' | 'gmail'
    email: text("email").notNull(),
    displayName: text("display_name"),
    accessToken: text("access_token"), // encrypted: iv:ciphertext
    refreshToken: text("refresh_token"), // encrypted: iv:ciphertext
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    status: text("status").notNull().default("connected"), // 'connected' | 'error' | 'disconnected'
    errorMessage: text("error_message"),
    authorizedByUserId: uuid("authorized_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_email_accounts_org").on(t.orgId)],
);

export const customerSourceEnum = pgEnum("customer_source", [
  "signature_parsed",
  "ai_extracted",
  "domain_derived",
  "free_provider_fallback",
  "manual",
]);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain"),
    source: customerSourceEnum("source"),
    extractionConfidence: numeric("extraction_confidence", { precision: 4, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_customers_org_domain").on(t.orgId, t.domain)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_contacts_org_email").on(t.orgId, t.email)],
);

export const rfqStatusEnum = pgEnum("rfq_status", [
  "new",
  "estimated",
  "quoted",
  "sent",
  "won",
  "lost",
  "no_bid",
]);

export const rfqSourceEnum = pgEnum("rfq_source", ["email", "manual", "manual_forward"]);

export const rfqs = pgTable(
  "rfqs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    rfqNumber: integer("rfq_number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    emailAccountId: uuid("email_account_id").references(() => emailAccounts.id, {
      onDelete: "set null",
    }),
    subject: text("subject"),
    source: rfqSourceEnum("source").notNull().default("manual"),
    quantityBreaks: integer("quantity_breaks").array().notNull().default([1, 10, 100]),
    status: rfqStatusEnum("status").notNull().default("new"),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    lastEmailAt: timestamp("last_email_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_rfqs_org_status").on(t.orgId, t.status),
    index("idx_rfqs_org_received").on(t.orgId, t.receivedAt),
  ],
);

export const emailThreads = pgTable(
  "email_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "cascade" }),
    providerThreadId: text("provider_thread_id").notNull(),
    provider: text("provider").notNull(), // 'microsoft' | 'gmail'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_email_threads_rfq").on(t.rfqId)],
);

export const emailMessages = pgTable(
  "email_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => emailThreads.id, { onDelete: "cascade" }),
    providerMessageId: text("provider_message_id").notNull(),
    direction: text("direction").notNull(), // 'inbound' | 'outbound'
    fromEmail: text("from_email"),
    fromName: text("from_name"),
    toEmails: text("to_emails").array(),
    ccEmails: text("cc_emails").array(),
    bccEmails: text("bcc_emails").array(),
    subject: text("subject"),
    bodyText: text("body_text"),
    status: text("status"), // outbound: 'sent' | 'draft' | 'failed'; inbound: null
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_email_messages_thread").on(t.threadId, t.receivedAt)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    rfqId: uuid("rfq_id").references(() => rfqs.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => emailMessages.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes"),
    storageKey: text("storage_key").notNull(),
    category: text("category").notNull().default("other"),
    partId: uuid("part_id").references(() => parts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_attachments_rfq").on(t.rfqId),
    check("attachments_category_check", sql`${t.category} IN ('drawing', 'cad', 'bom', 'other')`),
  ],
);

export const blockList = pgTable(
  "block_list",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    value: text("value").notNull(), // email address or @domain.com
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_block_list_org").on(t.orgId)],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const orgsRelations = relations(orgs, ({ many }) => ({
  memberships: many(memberships),
  auditLog: many(auditLog),
  aiRuns: many(aiRuns),
  emailAccounts: many(emailAccounts),
  customers: many(customers),
  contacts: many(contacts),
  rfqs: many(rfqs),
  blockList: many(blockList),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  rfqs: many(rfqs),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  org: one(orgs, { fields: [memberships.orgId], references: [orgs.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  org: one(orgs, { fields: [auditLog.orgId], references: [orgs.id] }),
  user: one(users, { fields: [auditLog.userId], references: [users.id] }),
}));

export const aiRunsRelations = relations(aiRuns, ({ one }) => ({
  org: one(orgs, { fields: [aiRuns.orgId], references: [orgs.id] }),
}));

export const emailAccountsRelations = relations(emailAccounts, ({ one, many }) => ({
  org: one(orgs, { fields: [emailAccounts.orgId], references: [orgs.id] }),
  authorizedBy: one(users, { fields: [emailAccounts.authorizedByUserId], references: [users.id] }),
  rfqs: many(rfqs),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  org: one(orgs, { fields: [customers.orgId], references: [orgs.id] }),
  contacts: many(contacts),
  rfqs: many(rfqs),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  org: one(orgs, { fields: [contacts.orgId], references: [orgs.id] }),
  customer: one(customers, { fields: [contacts.customerId], references: [customers.id] }),
  rfqs: many(rfqs),
}));

export const rfqsRelations = relations(rfqs, ({ one, many }) => ({
  org: one(orgs, { fields: [rfqs.orgId], references: [orgs.id] }),
  customer: one(customers, { fields: [rfqs.customerId], references: [customers.id] }),
  contact: one(contacts, { fields: [rfqs.contactId], references: [contacts.id] }),
  emailAccount: one(emailAccounts, {
    fields: [rfqs.emailAccountId],
    references: [emailAccounts.id],
  }),
  assignee: one(users, { fields: [rfqs.assigneeId], references: [users.id] }),
  threads: many(emailThreads),
  attachments: many(attachments),
  parts: many(parts),
  quotes: many(quotes),
}));

export const emailThreadsRelations = relations(emailThreads, ({ one, many }) => ({
  org: one(orgs, { fields: [emailThreads.orgId], references: [orgs.id] }),
  rfq: one(rfqs, { fields: [emailThreads.rfqId], references: [rfqs.id] }),
  messages: many(emailMessages),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one, many }) => ({
  org: one(orgs, { fields: [emailMessages.orgId], references: [orgs.id] }),
  thread: one(emailThreads, { fields: [emailMessages.threadId], references: [emailThreads.id] }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  org: one(orgs, { fields: [attachments.orgId], references: [orgs.id] }),
  rfq: one(rfqs, { fields: [attachments.rfqId], references: [rfqs.id] }),
  message: one(emailMessages, { fields: [attachments.messageId], references: [emailMessages.id] }),
  part: one(parts, { fields: [attachments.partId], references: [parts.id] }),
}));

export const blockListRelations = relations(blockList, ({ one }) => ({
  org: one(orgs, { fields: [blockList.orgId], references: [orgs.id] }),
}));

// ─── Epic 2: Estimating & Quoting ────────────────────────────────────────────

export const parts = pgTable(
  "parts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "cascade" }),
    partNumber: text("part_number"),
    revision: text("revision"),
    description: text("description"),
    material: text("material"),
    finish: text("finish"),
    processType: text("process_type"),
    notesExternal: text("notes_external"),
    notesInternal: text("notes_internal"),
    materialCostCents: integer("material_cost_cents").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_parts_rfq").on(t.rfqId)],
);

export const partOperations = pgTable(
  "part_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    partId: uuid("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    operationType: text("operation_type").notNull().default("machining"),
    setupMinutes: numeric("setup_minutes").notNull().default("0"),
    runMinutes: numeric("run_minutes").notNull().default("0"),
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
    isNonRecurring: boolean("is_non_recurring").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_part_operations_part").on(t.partId)],
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    rfqId: uuid("rfq_id")
      .notNull()
      .references(() => rfqs.id, { onDelete: "cascade" }),
    quoteNumber: integer("quote_number").notNull(),
    status: text("status").notNull().default("draft"), // 'draft' | 'sent'
    notesForCustomer: text("notes_for_customer"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_quotes_rfq").on(t.rfqId)],
);

export const quoteLineItems = pgTable(
  "quote_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    partId: uuid("part_id").references(() => parts.id, { onDelete: "set null" }),
    quantity: integer("quantity").notNull(),
    costPerUnitCents: integer("cost_per_unit_cents").notNull().default(0),
    markupPct: numeric("markup_pct").notNull().default("30"),
    quoteUnitPriceCents: integer("quote_unit_price_cents"),
    leadTimeWeeks: integer("lead_time_weeks"),
    isNoBid: boolean("is_no_bid").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_quote_line_items_quote").on(t.quoteId)],
);

export const operationTemplates = pgTable(
  "operation_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    operationType: text("operation_type").notNull().default("machining"),
    defaultSetupMinutes: numeric("default_setup_minutes").notNull().default("0"),
    defaultRunMinutes: numeric("default_run_minutes").notNull().default("0"),
    defaultHourlyRateCents: integer("default_hourly_rate_cents").notNull().default(0),
    usageCount: integer("usage_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_operation_templates_org").on(t.orgId)],
);

// ─── Epic 2 Relations ─────────────────────────────────────────────────────────

export const partsRelations = relations(parts, ({ one, many }) => ({
  org: one(orgs, { fields: [parts.orgId], references: [orgs.id] }),
  rfq: one(rfqs, { fields: [parts.rfqId], references: [rfqs.id] }),
  attachments: many(attachments),
  operations: many(partOperations),
  quoteLineItems: many(quoteLineItems),
}));

export const partOperationsRelations = relations(partOperations, ({ one }) => ({
  org: one(orgs, { fields: [partOperations.orgId], references: [orgs.id] }),
  part: one(parts, { fields: [partOperations.partId], references: [parts.id] }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  org: one(orgs, { fields: [quotes.orgId], references: [orgs.id] }),
  rfq: one(rfqs, { fields: [quotes.rfqId], references: [rfqs.id] }),
  createdBy: one(users, { fields: [quotes.createdByUserId], references: [users.id] }),
  lineItems: many(quoteLineItems),
}));

export const quoteLineItemsRelations = relations(quoteLineItems, ({ one }) => ({
  org: one(orgs, { fields: [quoteLineItems.orgId], references: [orgs.id] }),
  quote: one(quotes, { fields: [quoteLineItems.quoteId], references: [quotes.id] }),
  part: one(parts, { fields: [quoteLineItems.partId], references: [parts.id] }),
}));

export const operationTemplatesRelations = relations(operationTemplates, ({ one }) => ({
  org: one(orgs, { fields: [operationTemplates.orgId], references: [orgs.id] }),
}));

// ─── Quote Template (Settings) ────────────────────────────────────────────────
// One row per org. Captures everything needed to render a German-standard
// (DIN 5008) quote PDF, including the legally-required footer (Pflichtangaben).

export const legalFormEnum = pgEnum("legal_form", [
  "sole_trader",
  "eK",
  "GbR",
  "GmbH",
  "UG",
  "AG",
  "GmbH_Co_KG",
  "OHG",
  "KG",
  "other",
]);

export interface TemplateContact {
  roleLabel: string;
  name: string;
  phone: string;
  email: string;
}

export interface TemplateBankAccount {
  bankName: string;
  iban: string;
  bic: string;
}

export const quoteTemplates = pgTable(
  "quote_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .unique()
      .references(() => orgs.id, { onDelete: "cascade" }),

    // Identity & letterhead
    logoUrl: text("logo_url"),
    slogan: text("slogan").notNull().default(""),
    companyName: text("company_name").notNull().default(""),
    legalForm: legalFormEnum("legal_form").notNull().default("GmbH"),
    street: text("street").notNull().default(""),
    postalCode: text("postal_code").notNull().default(""),
    city: text("city").notNull().default(""),
    country: text("country").notNull().default("Germany"),
    phone: text("phone").notNull().default(""),
    fax: text("fax").notNull().default(""),
    email: text("email").notNull().default(""),
    website: text("website").notNull().default(""),
    senderPlace: text("sender_place").notNull().default(""),

    // Locale & tax
    locale: text("locale").notNull().default("en-US"),
    currency: text("currency").notNull().default("EUR"),
    vatRate: numeric("vat_rate").notNull().default("19"),
    reducedVatRate: numeric("reduced_vat_rate").notNull().default("7"),
    smallBusiness: boolean("small_business").notNull().default(false),

    // Quote body text
    subjectTemplate: text("subject_template").notNull().default("Quote No. {quoteNo}"),
    introText: text("intro_text").notNull().default(""),
    closingText: text("closing_text").notNull().default("Kind regards"),
    validityDays: integer("validity_days").notNull().default(30),
    deliveryTerms: text("delivery_terms").notNull().default("ex works"),
    paymentTerms: text("payment_terms").notNull().default("Net 14 days."),
    termsText: text("terms_text").notNull().default(""),

    // Contacts
    contacts: jsonb("contacts").$type<TemplateContact[]>().notNull().default(sql`'[]'::jsonb`),

    // Legal footer (Pflichtangaben)
    managingDirectors: jsonb("managing_directors")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    registerCourt: text("register_court").notNull().default(""),
    registerNumber: text("register_number").notNull().default(""),
    jurisdiction: text("jurisdiction").notNull().default(""),
    taxNumber: text("tax_number").notNull().default(""),
    vatId: text("vat_id").notNull().default(""),

    // Bank accounts
    bankAccounts: jsonb("bank_accounts")
      .$type<TemplateBankAccount[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Optional footer logos (storage keys, e.g. certification marks)
    footerLogos: jsonb("footer_logos").$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_quote_templates_org").on(t.orgId)],
);

export const quoteTemplatesRelations = relations(quoteTemplates, ({ one }) => ({
  org: one(orgs, { fields: [quoteTemplates.orgId], references: [orgs.id] }),
}));
