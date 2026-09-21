import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import QRCode from "qrcode";

// Never break words mid-way with a hyphen (e.g. "Busi-ness"); wrap at spaces.
Font.registerHyphenationCallback((word) => [word]);
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

/* Palette — matches the app's calm "Mist" theme. */
const C = {
  primary: "#4f6d97",
  primaryDark: "#37527a",
  ink: "#1f2733",
  body: "#3f4855",
  muted: "#6b7480",
  faint: "#9aa4b2",
  line: "#e3e8ef",
  soft: "#f2f5f9",
  softer: "#f7f9fc",
  white: "#ffffff",
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#eef1f5", fg: "#5c6675" },
  unpaid: { bg: "#f6ecd8", fg: "#8a6510" },
  partially_paid: { bg: "#e5edf7", fg: "#37527a" },
  paid: { bg: "#dcefe7", fg: "#2f6f52" },
  void: { bg: "#eef0f3", fg: "#8b95a5" },
};

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 48, fontSize: 9.5, fontFamily: "Helvetica", color: C.body, lineHeight: 1.5 },
  accentBar: { height: 6, backgroundColor: C.primary },
  body: { paddingHorizontal: 44, paddingTop: 30 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26 },
  headerLeft: { width: "58%", flexDirection: "row", alignItems: "flex-start" },
  monogram: { width: 34, height: 34, borderRadius: 8, backgroundColor: C.primary, marginRight: 10, marginTop: 1, alignItems: "center", justifyContent: "center" },
  monogramText: { color: C.white, fontFamily: "Helvetica-Bold", fontSize: 14 },
  leftText: { flex: 1 },
  logo: { width: 130, maxHeight: 52, objectFit: "contain", marginBottom: 8 },
  bizName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 4 },
  addr: { color: C.muted, fontSize: 9 },

  right: { alignItems: "flex-end", width: "40%" },
  invoiceWord: { fontSize: 24, fontFamily: "Helvetica-Bold", color: C.primary, letterSpacing: 2, marginBottom: 12 },
  metaBox: { backgroundColor: C.soft, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, width: 200 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  metaLabel: { color: C.muted, fontSize: 9 },
  metaValue: { color: C.ink, fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  badge: { marginTop: 10, alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 11, borderRadius: 20, fontSize: 8.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  amountDue: { fontFamily: "Helvetica-Bold", fontSize: 18, color: C.ink },
  bank: { marginTop: 22, backgroundColor: C.softer, borderRadius: 6, padding: 12, borderWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bankText: { flex: 1, paddingRight: 14 },
  qrWrap: { alignItems: "center" },
  qr: { width: 74, height: 74 },
  qrCaption: { fontSize: 7.5, color: C.muted, marginTop: 3 },

  billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  block: { width: "48%" },
  eyebrow: { fontSize: 8, color: C.faint, fontFamily: "Helvetica-Bold", letterSpacing: 1, marginBottom: 5 },
  custName: { fontFamily: "Helvetica-Bold", fontSize: 11.5, color: C.ink, marginBottom: 2 },

  thead: { flexDirection: "row", backgroundColor: C.primary, borderRadius: 5, paddingVertical: 7, paddingHorizontal: 10 },
  th: { color: C.white, fontFamily: "Helvetica-Bold", fontSize: 8.5, letterSpacing: 0.3 },
  trow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  cDesc: { width: "44%" }, cQty: { width: "12%", textAlign: "right" }, cPrice: { width: "17%", textAlign: "right" }, cTax: { width: "10%", textAlign: "right" }, cTotal: { width: "17%", textAlign: "right" },
  itemName: { color: C.ink, fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  cell: { color: C.body, fontSize: 9.5 },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 18 },
  totals: { width: "46%" },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  tLabel: { color: C.muted }, tVal: { color: C.ink, fontFamily: "Helvetica-Bold" },
  grand: { flexDirection: "row", justifyContent: "space-between", marginTop: 7, paddingTop: 9, borderTopWidth: 1.5, borderTopColor: C.ink },
  grandLabel: { fontFamily: "Helvetica-Bold", fontSize: 12, color: C.ink },
  grandVal: { fontFamily: "Helvetica-Bold", fontSize: 12, color: C.ink },

  due: { marginTop: 12, backgroundColor: C.soft, borderRadius: 6, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderLeftWidth: 3, borderLeftColor: C.primary },
  dueLabel: { color: C.primaryDark, fontFamily: "Helvetica-Bold", fontSize: 10 },
  dueVal: { color: C.primaryDark, fontFamily: "Helvetica-Bold", fontSize: 15 },

  footer: { marginTop: 26, flexDirection: "row", justifyContent: "space-between" },
  footBlock: { width: "48%" },
  footHead: { fontFamily: "Helvetica-Bold", color: C.ink, fontSize: 9, marginBottom: 3 },
  footText: { color: C.muted, fontSize: 8.5 },
  pageFooter: { position: "absolute", bottom: 22, left: 44, right: 44, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  pageFootText: { color: C.faint, fontSize: 8 },
});

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase() || "IB";
}

function addressLines(b: BusinessSnapshot): string[] {
  return [
    b.addressLine1,
    b.addressLine2,
    [b.city, b.state, b.postalCode].filter(Boolean).join(", "),
    b.country,
  ].filter((l): l is string => Boolean(l && l.trim()));
}

function InvoiceDocument({
  invoice,
  items,
  business,
  customer,
  qr,
}: RenderInvoiceInput & { qr?: string | null }) {
  const currency = invoice.currency;
  const status = STATUS_COLORS[invoice.status] ?? STATUS_COLORS.draft;
  const discountAmount = invoice.subtotal + invoice.taxTotal - invoice.total;
  const balance = invoice.total - invoice.amountPaid;
  const hasDiscount = discountAmount > 0 && invoice.discountType !== "none";
  const discountLabel =
    invoice.discountType === "percent"
      ? `Discount (${(invoice.discountValue / 100).toFixed(invoice.discountValue % 100 ? 2 : 0)}%)`
      : "Discount";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} />
        <View style={styles.body}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {business.logoUrl ? null : (
                <View style={styles.monogram}>
                  <Text style={styles.monogramText}>{initials(business.name)}</Text>
                </View>
              )}
              <View style={styles.leftText}>
                {business.logoUrl ? (
                  <Image style={styles.logo} src={business.logoUrl} />
                ) : null}
                <Text style={styles.bizName}>{business.name}</Text>
                {addressLines(business).map((line, i) => (
                  <Text key={i} style={styles.addr}>{line}</Text>
                ))}
              </View>
            </View>

            <View style={styles.right}>
              <Text style={styles.invoiceWord}>INVOICE</Text>
              <View style={styles.metaBox}>
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
              </View>
              <Text style={[styles.badge, { backgroundColor: status.bg, color: status.fg }]}>
                {statusLabel(invoice.status).toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Bill to */}
          <View style={styles.billRow}>
            <View style={styles.block}>
              <Text style={styles.eyebrow}>BILL TO</Text>
              <Text style={styles.custName}>{customer.name}</Text>
              {customer.email ? <Text style={styles.addr}>{customer.email}</Text> : null}
              {customer.phone ? <Text style={styles.addr}>{customer.phone}</Text> : null}
              {customer.billingAddress ? (
                <Text style={styles.addr}>{customer.billingAddress}</Text>
              ) : null}
            </View>
            <View style={[styles.block, { alignItems: "flex-end" }]}>
              <Text style={styles.eyebrow}>AMOUNT DUE</Text>
              <Text style={styles.amountDue}>{formatMoney(balance, currency)}</Text>
            </View>
          </View>

          {/* Line items */}
          <View style={styles.thead}>
            <Text style={[styles.cDesc, styles.th]}>DESCRIPTION</Text>
            <Text style={[styles.cQty, styles.th]}>QTY</Text>
            <Text style={[styles.cPrice, styles.th]}>UNIT PRICE</Text>
            <Text style={[styles.cTax, styles.th]}>TAX</Text>
            <Text style={[styles.cTotal, styles.th]}>AMOUNT</Text>
          </View>
          {items.map((it) => (
            <View key={it.id} style={styles.trow}>
              <Text style={[styles.cDesc, styles.itemName]}>{it.description}</Text>
              <Text style={[styles.cQty, styles.cell]}>{formatQty(it.quantity)}</Text>
              <Text style={[styles.cPrice, styles.cell]}>{formatMoney(it.unitPrice, currency)}</Text>
              <Text style={[styles.cTax, styles.cell]}>{it.taxRateBps ? `${(it.taxRateBps / 100).toFixed(it.taxRateBps % 100 ? 2 : 0)}%` : "—"}</Text>
              <Text style={[styles.cTotal, styles.itemName]}>{formatMoney(it.lineTotal, currency)}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totalsWrap}>
            <View style={styles.totals}>
              <View style={styles.tRow}>
                <Text style={styles.tLabel}>Subtotal</Text>
                <Text style={styles.tVal}>{formatMoney(invoice.subtotal, currency)}</Text>
              </View>
              {hasDiscount ? (
                <View style={styles.tRow}>
                  <Text style={styles.tLabel}>{discountLabel}</Text>
                  <Text style={[styles.tVal, { color: "#2f6f52" }]}>−{formatMoney(discountAmount, currency)}</Text>
                </View>
              ) : null}
              <View style={styles.tRow}>
                <Text style={styles.tLabel}>Tax</Text>
                <Text style={styles.tVal}>{formatMoney(invoice.taxTotal, currency)}</Text>
              </View>
              <View style={styles.grand}>
                <Text style={styles.grandLabel}>Total</Text>
                <Text style={styles.grandVal}>{formatMoney(invoice.total, currency)}</Text>
              </View>
              {invoice.amountPaid > 0 ? (
                <>
                  <View style={styles.tRow}>
                    <Text style={styles.tLabel}>Amount paid</Text>
                    <Text style={styles.tVal}>−{formatMoney(invoice.amountPaid, currency)}</Text>
                  </View>
                  <View style={styles.due}>
                    <Text style={styles.dueLabel}>Balance Due</Text>
                    <Text style={styles.dueVal}>{formatMoney(balance, currency)}</Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>

          {/* Payment / bank details + QR */}
          {business.bankDetails ? (
            <View style={styles.bank}>
              <View style={styles.bankText}>
                <Text style={styles.footHead}>Payment Details</Text>
                <Text style={styles.footText}>{business.bankDetails}</Text>
              </View>
              {qr ? (
                <View style={styles.qrWrap}>
                  <Image style={styles.qr} src={qr} />
                  <Text style={styles.qrCaption}>Scan to pay</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Notes & terms */}
          {invoice.notes || invoice.terms ? (
            <View style={styles.footer}>
              {invoice.notes ? (
                <View style={styles.footBlock}>
                  <Text style={styles.footHead}>Notes</Text>
                  <Text style={styles.footText}>{invoice.notes}</Text>
                </View>
              ) : <View style={styles.footBlock} />}
              {invoice.terms ? (
                <View style={styles.footBlock}>
                  <Text style={styles.footHead}>Terms</Text>
                  <Text style={styles.footText}>{invoice.terms}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Page footer */}
        <View style={styles.pageFooter} fixed>
          <Text style={styles.pageFootText}>{business.name}</Text>
          <Text style={styles.pageFootText}>
            {invoice.number ?? "Draft"} · {formatMoney(invoice.total, currency)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** Render a finalized (or draft) invoice to a PDF Buffer. */
export async function renderInvoicePdf(input: RenderInvoiceInput): Promise<Buffer> {
  const { invoice, business } = input;
  let qr: string | null = null;

  // A "scan to pay" QR encoding the payment summary + bank details, so a
  // customer can capture where/how much to pay from their phone.
  if (business.bankDetails) {
    const balance = invoice.total - invoice.amountPaid;
    const payload = [
      `Payment to: ${business.name}`,
      invoice.number ? `Invoice: ${invoice.number}` : null,
      `Amount: ${formatMoney(balance, invoice.currency)}`,
      "",
      business.bankDetails,
    ]
      .filter((l): l is string => l !== null)
      .join("\n");
    try {
      qr = await QRCode.toDataURL(payload, {
        margin: 1,
        width: 220,
        errorCorrectionLevel: "M",
        color: { dark: "#1f2733", light: "#ffffff" },
      });
    } catch {
      qr = null;
    }
  }

  return renderToBuffer(<InvoiceDocument {...input} qr={qr} />);
}
