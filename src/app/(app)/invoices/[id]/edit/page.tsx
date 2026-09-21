"use client";

import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import type { InvoiceDetail } from "@/lib/types";
import {
  InvoiceEditor,
  InvoiceEditorLoading,
} from "@/components/invoices/invoice-editor";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();

  const { data, loading, error, refetch } = useAsync<InvoiceDetail>(
    () => apiGet<InvoiceDetail>(`/api/invoices/${id}`),
    [id],
  );

  // Only drafts are editable; bounce finalized invoices to their detail page.
  useEffect(() => {
    if (data && data.invoice.status !== "draft") {
      toast({
        variant: "warning",
        title: "This invoice is finalized",
        description: "Finalized invoices can't be edited.",
      });
      router.replace(`/invoices/${id}`);
    }
  }, [data, id, router, toast]);

  if (loading) return <InvoiceEditorLoading />;
  if (error)
    return (
      <Card>
        <ErrorState description={error} onRetry={refetch} />
      </Card>
    );
  if (!data || data.invoice.status !== "draft") return <InvoiceEditorLoading />;

  return <InvoiceEditor mode="edit" invoice={data} />;
}
