import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*  Better Auth tables                                                        */
/*  User carries our app-specific fields: role, businessId, isActive.         */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  // app fields
  role: text("role").$type<"admin" | "staff">().default("staff").notNull(),
  businessId: uuid("business_id"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

/* -------------------------------------------------------------------------- */
/*  Business domain                                                           */
/*  Money is always integer minor units (cents). Quantities are x1000.        */
/* -------------------------------------------------------------------------- */

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country"),
  logoUrl: text("logo_url"),
  defaultCurrency: text("default_currency").default("USD").notNull(),
  invoicePrefix: text("invoice_prefix").default("INV").notNull(),
  invoiceSeq: integer("invoice_seq").default(0).notNull(),
  // Payment reminder settings (Phase 3)
  reminderEnabled: boolean("reminder_enabled").default(false).notNull(),
  reminderDaysBefore: integer("reminder_days_before").default(3).notNull(),
  overdueReminderEnabled: boolean("overdue_reminder_enabled")
    .default(false)
    .notNull(),
  overdueReminderEveryDays: integer("overdue_reminder_every_days")
    .default(7)
    .notNull(),
  maxReminders: integer("max_reminders").default(3).notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
});

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    billingAddress: text("billing_address"),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at"),
    createdBy: text("created_by").references(() => user.id),
    updatedBy: text("updated_by").references(() => user.id),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
  },
  (t) => [index("customers_business_idx").on(t.businessId, t.deletedAt)],
);

export type InvoiceStatus =
  | "draft"
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "void";

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    recurringPlanId: uuid("recurring_plan_id"),
    number: text("number"),
    status: text("status").$type<InvoiceStatus>().default("draft").notNull(),
    currency: text("currency").notNull(),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    subtotal: integer("subtotal").default(0).notNull(),
    discountType: text("discount_type")
      .$type<"none" | "flat" | "percent">()
      .default("none")
      .notNull(),
    discountValue: integer("discount_value").default(0).notNull(),
    taxTotal: integer("tax_total").default(0).notNull(),
    total: integer("total").default(0).notNull(),
    amountPaid: integer("amount_paid").default(0).notNull(),
    notes: text("notes"),
    terms: text("terms"),
    customerSnapshot: jsonb("customer_snapshot"),
    businessSnapshot: jsonb("business_snapshot"),
    finalizedAt: timestamp("finalized_at"),
    sentAt: timestamp("sent_at"),
    deletedAt: timestamp("deleted_at"),
    createdBy: text("created_by").references(() => user.id),
    updatedBy: text("updated_by").references(() => user.id),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex("invoices_business_number_idx").on(t.businessId, t.number),
    index("invoices_status_idx").on(t.businessId, t.status, t.dueDate),
    index("invoices_customer_idx").on(t.customerId),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").default(1000).notNull(), // x1000
    unitPrice: integer("unit_price").default(0).notNull(), // minor units
    taxRateBps: integer("tax_rate_bps").default(0).notNull(), // basis points
    lineSubtotal: integer("line_subtotal").default(0).notNull(),
    lineTax: integer("line_tax").default(0).notNull(),
    lineTotal: integer("line_total").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    method: text("method")
      .$type<"bank_transfer" | "cash" | "cheque" | "card_offline" | "other">()
      .notNull(),
    paidAt: date("paid_at").notNull(),
    reference: text("reference"),
    proofBlobKey: text("proof_blob_key"),
    proofFileName: text("proof_file_name"),
    proofContentType: text("proof_content_type"),
    status: text("status").$type<"active" | "void">().default("active").notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId, t.status)],
);

export type RecurringItem = {
  description: string;
  quantity: number; // x1000
  unitPrice: number; // minor units
  taxRateBps: number;
};

export const recurringPlans = pgTable(
  "recurring_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    status: text("status")
      .$type<"active" | "paused" | "ended">()
      .default("active")
      .notNull(),
    cycle: text("cycle").$type<"monthly">().default("monthly").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    maxCycles: integer("max_cycles"),
    cyclesRun: integer("cycles_run").default(0).notNull(),
    nextRunDate: date("next_run_date").notNull(),
    lastRunDate: date("last_run_date"),
    autoEmail: boolean("auto_email").default(false).notNull(),
    currency: text("currency").notNull(),
    notes: text("notes"),
    terms: text("terms"),
    items: jsonb("items").$type<RecurringItem[]>().notNull(),
    deletedAt: timestamp("deleted_at"),
    createdBy: text("created_by").references(() => user.id),
    updatedBy: text("updated_by").references(() => user.id),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
  },
  (t) => [index("recurring_next_run_idx").on(t.status, t.nextRunDate)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<"admin" | "staff">().default("staff").notNull(),
    token: text("token").notNull().unique(),
    status: text("status")
      .$type<"pending" | "accepted" | "revoked">()
      .default("pending")
      .notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
  },
  (t) => [index("invitations_business_idx").on(t.businessId, t.status)],
);

export const invoiceReminders = pgTable(
  "invoice_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"before_due" | "overdue">().notNull(),
    sentAt: timestamp("sent_at").$defaultFn(() => new Date()).notNull(),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  },
  (t) => [index("invoice_reminders_invoice_idx").on(t.invoiceId)],
);

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
});

/* -------------------------------------------------------------------------- */

export type Business = typeof businesses.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type RecurringPlan = typeof recurringPlans.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type InvoiceReminder = typeof invoiceReminders.$inferSelect;
export type ActivityLog = typeof activityLog.$inferSelect;
export type User = typeof user.$inferSelect;
