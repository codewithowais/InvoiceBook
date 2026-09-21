import { z } from "zod";

export const currencyCodes = ["USD", "EUR", "GBP", "PKR", "AED", "INR", "CAD", "AUD"] as const;

export const businessUpdateSchema = z.object({
  name: z.string().min(1).max(120),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  bankDetails: z.string().max(2000).optional().nullable(),
  defaultCurrency: z.string().length(3).default("USD"),
  invoicePrefix: z.string().min(1).max(10).default("INV"),
});

export const customerCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Valid email required"),
  phone: z.string().max(40).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const lineItemSchema = z.object({
  description: z.string().min(1, "Description required").max(300),
  quantity: z.number().int().positive(), // x1000
  unitPrice: z.number().int().min(0), // minor units
  taxRateBps: z.number().int().min(0).max(100000).default(0),
});

export const discountSchema = z.object({
  discountType: z.enum(["none", "flat", "percent"]).default("none"),
  discountValue: z.number().int().min(0).default(0),
});

export const invoiceCreateSchema = z
  .object({
    customerId: z.string().uuid(),
    issueDate: z.string(), // ISO date (yyyy-mm-dd)
    dueDate: z.string(),
    currency: z.string().length(3),
    items: z.array(lineItemSchema).min(1, "Add at least one line item"),
    notes: z.string().max(2000).optional().nullable(),
    terms: z.string().max(2000).optional().nullable(),
  })
  .merge(discountSchema);

export const invoiceUpdateSchema = invoiceCreateSchema.partial().extend({
  items: z.array(lineItemSchema).optional(),
});

export const paymentSchema = z.object({
  amount: z.number().int().positive("Amount must be greater than zero"),
  method: z.enum(["bank_transfer", "cash", "cheque", "card_offline", "other"]),
  paidAt: z.string(), // ISO date
  reference: z.string().max(120).optional().nullable(),
  proofBlobKey: z.string().min(1),
  proofFileName: z.string().min(1),
  proofContentType: z.string().min(1),
});

export const recurringPlanSchema = z.object({
  customerId: z.string().uuid(),
  currency: z.string().length(3),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  maxCycles: z.number().int().positive().optional().nullable(),
  autoEmail: z.boolean().default(false),
  items: z.array(lineItemSchema).min(1),
  notes: z.string().max(2000).optional().nullable(),
  terms: z.string().max(2000).optional().nullable(),
});

export const recurringPlanUpdateSchema = recurringPlanSchema.partial();

export const productCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  description: z.string().max(1000).optional().nullable(),
  unitPrice: z.number().int().min(0), // minor units (flat monthly price)
  taxRateBps: z.number().int().min(0).max(100000).default(0),
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const inviteCreateSchema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["admin", "staff"]).default("staff"),
});

export const teamMemberUpdateSchema = z.object({
  role: z.enum(["admin", "staff"]).optional(),
  isActive: z.boolean().optional(),
});

export const reportRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const reminderSettingsSchema = z.object({
  reminderEnabled: z.boolean(),
  reminderDaysBefore: z.number().int().min(0).max(60),
  overdueReminderEnabled: z.boolean(),
  overdueReminderEveryDays: z.number().int().min(1).max(90),
  maxReminders: z.number().int().min(1).max(20),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type RecurringPlanInput = z.infer<typeof recurringPlanSchema>;
