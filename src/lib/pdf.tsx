import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { Invoice, InvoiceItem } from "@/db/schema";
import type { BusinessSnapshot, CustomerSnapshot } from "@/lib/invoice-service";
import { formatMoney, formatQty } from "@/lib/money";
import { formatDate, statusLabel } from "@/lib/format";

export type RenderInvoiceInput = {
  invoice: Invoice;
  items: InvoiceItem[];
  business: BusinessSnapshot;
  customer: CustomerSnapshot;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1f2937",
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  logo: { width: 120, maxHeight: 56, objectFit: "contain", marginBottom: 8 },
  bizName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  muted: { color: "#6b7280" },
  right: { textAlign: "right" },
  invoiceTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 6,
  },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  metaLabel: { color: "#6b7280", width: 70, textAlign: "right" },
  metaValue: { fontFamily: "Helvetica-Bold", width: 90, textAlign: "right" },
  statusBadge: {
    marginTop: 6,
    alignSelf: "flex-end",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: "#eef2ff",
    color: "#3730a3",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  section: { marginBottom: 20 },
  billTo: { fontSize: 9, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" },
  custName: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 2 },
  table: { marginTop: 8 },
  thead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 6,
    marginBottom: 2,
  },
  trow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 6,
  },
  cDesc: { width: "42%" },
  cQty: { width: "12%", textAlign: "right" },
  cPrice: { width: "16%", textAlign: "right" },
  cTax: { width: "12%", textAlign: "right" },
  cTotal: { width: "18%", textAlign: "right" },
  thText: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  totals: { marginTop: 16, alignSelf: "flex-end", width: "45%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#111827",
  },
  grandText: { fontFamily: "Helvetica-Bold", fontSize: 13 },
  footer: {
    marginTop: 30,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footerHead: { fontFamily: "Helvetica-Bold", marginBottom: 3 },
});

function addressLines(b: BusinessSnapshot): string[] {
  return [
    b.addressLine1,
    b.addressLine2,
    [b.city, b.state, b.postalCode].filter(Boolean).join(", "),
    b.country,
  ].filter((l): l is string => Boolean(l && l.trim()));
}

function InvoiceDocument({ invoice, items, business, customer }: RenderInvoiceInput) {
  const currency = invoice.currency;
  const discountLabel =
    invoice.discountType === "percent"
      ? `Discount (${(invoice.discountValue / 100).toFixed(2)}%)`
      : "Discount";
  // Discount amount recomputed for display from stored totals.
  const discountAmount =
    invoice.subtotal + invoice.taxTotal - invoice.total;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {business.logoUrl ? (
              <Image style={styles.logo} src={business.logoUrl} />
            ) : null}
            <Text style={styles.bizName}>{business.name}</Text>
            {addressLines(business).map((line, i) => (
              <Text key={i} style={styles.muted}>
                {line}
              </Text>
            ))}
          </View>

          <View style={styles.right}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Number</Text>
              <Text style={styles.metaValue}>{invoice.number ?? "DRAFT"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Issued</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.dueDate)}</Text>
            </View>
            <Text style={styles.statusBadge}>
              {statusLabel(invoice.status).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.billTo}>Bill To</Text>
          <Text style={styles.custName}>{customer.name}</Text>
          {customer.email ? <Text style={styles.muted}>{customer.email}</Text> : null}
          {customer.phone ? <Text style={styles.muted}>{customer.phone}</Text> : null}
          {customer.billingAddress ? (
            <Text style={styles.muted}>{customer.billingAddress}</Text>
          ) : null}
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.cDesc, styles.thText]}>Description</Text>
            <Text style={[styles.cQty, styles.thText]}>Qty</Text>
            <Text style={[styles.cPrice, styles.thText]}>Unit Price</Text>
            <Text style={[styles.cTax, styles.thText]}>Tax</Text>
            <Text style={[styles.cTotal, styles.thText]}>Total</Text>
          </View>
          {items.map((it) => (
            <View key={it.id} style={styles.trow}>
              <Text style={styles.cDesc}>{it.description}</Text>
              <Text style={styles.cQty}>{formatQty(it.quantity)}</Text>
              <Text style={styles.cPrice}>
                {formatMoney(it.unitPrice, currency)}
              </Text>
              <Text style={styles.cTax}>
                {(it.taxRateBps / 100).toFixed(2)}%
              </Text>
              <Text style={styles.cTotal}>
                {formatMoney(it.lineTotal, currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{formatMoney(invoice.subtotal, currency)}</Text>
          </View>
          {discountAmount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>{discountLabel}</Text>
              <Text>-{formatMoney(discountAmount, currency)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Tax</Text>
            <Text>{formatMoney(invoice.taxTotal, currency)}</Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandText}>Total</Text>
            <Text style={styles.grandText}>
              {formatMoney(invoice.total, currency)}
            </Text>
          </View>
          {invoice.amountPaid > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Amount Paid</Text>
              <Text>-{formatMoney(invoice.amountPaid, currency)}</Text>
            </View>
          ) : null}
          {invoice.amountPaid > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Balance Due</Text>
              <Text>
                {formatMoney(invoice.total - invoice.amountPaid, currency)}
              </Text>
            </View>
          ) : null}
        </View>

        {invoice.notes || invoice.terms ? (
          <View style={styles.footer}>
            {invoice.notes ? (
              <>
                <Text style={styles.footerHead}>Notes</Text>
                <Text style={styles.muted}>{invoice.notes}</Text>
              </>
            ) : null}
            {invoice.terms ? (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.footerHead}>Terms</Text>
                <Text style={styles.muted}>{invoice.terms}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

/** Render a finalized (or draft) invoice to a PDF Buffer. */
export function renderInvoicePdf(input: RenderInvoiceInput): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...input} />);
}
