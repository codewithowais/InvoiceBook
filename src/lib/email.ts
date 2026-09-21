import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Provider-agnostic email over SMTP.
 *
 * Real delivery: set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / EMAIL_FROM.
 * Works with any free SMTP service (Gmail app password, Brevo, Mailtrap,
 * Resend SMTP, etc.).
 *
 * No config in development: we auto-create a free Ethereal test inbox on the
 * fly and return a `previewUrl` so you can view the sent email in a browser
 * without signing up for anything. In production with no config, sending fails
 * loudly instead of silently dropping mail.
 */

let cached: { transporter: Transporter; from: string; isEthereal: boolean } | null =
  null;

async function getTransport() {
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from =
    process.env.EMAIL_FROM ?? "InvoiceBook <no-reply@invoicebook.local>";

  if (host && user && pass) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // implicit TLS on 465, STARTTLS otherwise
      auth: { user, pass },
    });
    cached = { transporter, from, isEthereal: false };
    return cached;
  }

  if (process.env.NODE_ENV !== "production") {
    // Free, zero-signup test inbox. Emails aren't really delivered — you open
    // the returned preview URL to see them.
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    cached = {
      transporter,
      from: from,
      isEthereal: true,
    };
    return cached;
  }

  throw new Error(
    "Email is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS and EMAIL_FROM.",
  );
}

export type Attachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

/**
 * Generic transactional email send (reused by invoice send + reminders).
 * Returns a `previewUrl` when using the dev Ethereal test inbox.
 */
export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
}): Promise<SendResult> {
  const { transporter, from, isEthereal } = await getTransport();
  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
  const result: SendResult = { messageId: info.messageId };
  if (isEthereal) {
    const url = nodemailer.getTestMessageUrl(info);
    if (url) result.previewUrl = url;
  }
  return result;
}

export type InvoiceEmailInput = {
  to: string;
  businessName: string;
  invoiceNumber: string;
  amountLabel: string;
  dueDateLabel: string;
  message?: string | null;
  pdf: Buffer;
  pdfFilename: string;
};

export type SendResult = { messageId: string; previewUrl?: string };

export async function sendInvoiceEmail(
  input: InvoiceEmailInput,
): Promise<SendResult> {
  const { transporter, from, isEthereal } = await getTransport();

  const subject = `Invoice ${input.invoiceNumber} from ${input.businessName}`;
  const intro =
    input.message?.trim() ||
    `Please find attached invoice ${input.invoiceNumber} for ${input.amountLabel}, due ${input.dueDateLabel}.`;

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <h2 style="margin:0 0 4px">${escapeHtml(input.businessName)}</h2>
    <p style="color:#666;margin:0 0 20px">Invoice ${escapeHtml(input.invoiceNumber)}</p>
    <p style="line-height:1.6">${escapeHtml(intro)}</p>
    <table style="margin:20px 0;border-collapse:collapse">
      <tr><td style="padding:4px 16px 4px 0;color:#666">Amount due</td><td style="font-weight:600">${escapeHtml(input.amountLabel)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#666">Due date</td><td style="font-weight:600">${escapeHtml(input.dueDateLabel)}</td></tr>
    </table>
    <p style="color:#666;font-size:13px;line-height:1.6">The full invoice is attached as a PDF.</p>
  </div>`;

  const text = `${input.businessName}\nInvoice ${input.invoiceNumber}\n\n${intro}\n\nAmount due: ${input.amountLabel}\nDue date: ${input.dueDateLabel}\n\nThe full invoice is attached as a PDF.`;

  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: input.pdfFilename,
        content: input.pdf,
        contentType: "application/pdf",
      },
    ],
  });

  const result: SendResult = { messageId: info.messageId };
  if (isEthereal) {
    const url = nodemailer.getTestMessageUrl(info);
    if (url) result.previewUrl = url;
  }
  return result;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
