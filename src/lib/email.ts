import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Email delivery with three routes, chosen in this order:
 *
 *   1. Resend (recommended, free): set RESEND_API_KEY (+ EMAIL_FROM). HTTP API,
 *      no SMTP config. https://resend.com
 *   2. SMTP (optional fallback): set SMTP_HOST / SMTP_PORT / SMTP_USER /
 *      SMTP_PASS.
 *   3. Dev fallback: with nothing configured in development we spin up a free
 *      Ethereal test inbox and return a `previewUrl` to view the message.
 *
 * In production with none of the above, sending fails loudly.
 */

const DEFAULT_FROM = "InvoiceBook <onboarding@resend.dev>";

export type Attachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type SendResult = { messageId: string; previewUrl?: string };

type SendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
};

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? DEFAULT_FROM;
}

/* ------------------------------- Resend --------------------------------- */

async function sendViaResend(input: SendInput): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
      })),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string };
  return { messageId: data.id ?? "resend" };
}

/* -------------------------- SMTP / Ethereal ----------------------------- */

let cachedTransport:
  | { transporter: Transporter; isEthereal: boolean }
  | null = null;

async function getTransport() {
  if (cachedTransport) return cachedTransport;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    cachedTransport = { transporter, isEthereal: false };
    return cachedTransport;
  }

  if (process.env.NODE_ENV !== "production") {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    cachedTransport = { transporter, isEthereal: true };
    return cachedTransport;
  }

  throw new Error(
    "Email is not configured. Set RESEND_API_KEY (recommended) or SMTP_* variables.",
  );
}

async function sendViaSmtpOrEthereal(input: SendInput): Promise<SendResult> {
  const { transporter, isEthereal } = await getTransport();
  const info = await transporter.sendMail({
    from: fromAddress(),
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

/* ------------------------------- Public --------------------------------- */

/** Generic transactional send (reused by invoice send + reminders). */
export async function sendMail(input: SendInput): Promise<SendResult> {
  if (process.env.RESEND_API_KEY) return sendViaResend(input);
  return sendViaSmtpOrEthereal(input);
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

export async function sendInvoiceEmail(
  input: InvoiceEmailInput,
): Promise<SendResult> {
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

  return sendMail({
    to: input.to,
    subject,
    html,
    text,
    attachments: [
      {
        filename: input.pdfFilename,
        content: input.pdf,
        contentType: "application/pdf",
      },
    ],
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
