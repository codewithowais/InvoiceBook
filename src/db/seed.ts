/**
 * Demo data seeder. Run AFTER you have signed up (which creates your business),
 * with: `pnpm db:seed`
 *
 * It attaches sample customers, invoices and a recurring plan to the first
 * business in the database. It does NOT create auth users (sign up via the UI).
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  customers,
  invoices,
  invoiceItems,
  recurringPlans,
} from "@/db/schema";
import { computeTotals } from "@/lib/money";
import { addMonths, toISODate } from "@/lib/format";

async function main() {
  const [biz] = await db.select().from(businesses).limit(1);
  if (!biz) {
    console.error("No business found. Sign up in the app first, then re-run.");
    process.exit(1);
  }
  console.log(`Seeding demo data for business: ${biz.name} (${biz.id})`);

  const [acme] = await db
    .insert(customers)
    .values({
      businessId: biz.id,
      name: "Acme Corp",
      email: "billing@acme.example",
      phone: "+1 555 0100",
      billingAddress: "100 Market St, Springfield",
    })
    .returning();

  const [globex] = await db
    .insert(customers)
    .values({
      businessId: biz.id,
      name: "Globex LLC",
      email: "accounts@globex.example",
      phone: "+1 555 0110",
      billingAddress: "42 Industrial Ave, Metropolis",
    })
    .returning();

  const cur = biz.defaultCurrency;
  const items1 = [
    { description: "Consulting — September", quantity: 10000, unitPrice: 15000, taxRateBps: 0 },
    { description: "Hosting", quantity: 1000, unitPrice: 5000, taxRateBps: 0 },
  ];
  const t1 = computeTotals({ items: items1, discountType: "none", discountValue: 0 });

  // increment seq for a proper invoice number
  const [b1] = await db
    .update(businesses)
    .set({ invoiceSeq: biz.invoiceSeq + 1 })
    .where(eq(businesses.id, biz.id))
    .returning();

  const seq = b1.invoiceSeq;
  const num1 = `${biz.invoicePrefix}-${String(seq).padStart(4, "0")}`;

  const [inv1] = await db
    .insert(invoices)
    .values({
      businessId: biz.id,
      customerId: acme.id,
      number: num1,
      status: "unpaid",
      currency: cur,
      issueDate: toISODate(new Date()),
      dueDate: toISODate(addMonths(new Date(), 1)),
      subtotal: t1.subtotal,
      taxTotal: t1.taxTotal,
      total: t1.total,
      finalizedAt: new Date(),
    })
    .returning();

  await db.insert(invoiceItems).values(
    items1.map((it, i) => {
      const line = t1.lines[i];
      return {
        invoiceId: inv1.id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRateBps: it.taxRateBps,
        lineSubtotal: line.lineSubtotal,
        lineTax: line.lineTax,
        lineTotal: line.lineTotal,
        sortOrder: i,
      };
    }),
  );

  // A recurring monthly plan for Globex
  await db.insert(recurringPlans).values({
    businessId: biz.id,
    customerId: globex.id,
    status: "active",
    cycle: "monthly",
    startDate: toISODate(new Date()),
    nextRunDate: toISODate(new Date()),
    currency: cur,
    items: [
      { description: "Monthly retainer", quantity: 1000, unitPrice: 200000, taxRateBps: 0 },
    ],
    notes: "Auto-generated monthly retainer",
  });

  console.log("Seed complete:");
  console.log(`  • 2 customers (Acme, Globex)`);
  console.log(`  • 1 unpaid invoice ${num1}`);
  console.log(`  • 1 monthly recurring plan for Globex`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
