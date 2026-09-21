import { InvoiceEditor } from "@/components/invoices/invoice-editor";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const customer =
    typeof params.customer === "string" ? params.customer : undefined;
  return <InvoiceEditor mode="create" presetCustomerId={customer} />;
}
