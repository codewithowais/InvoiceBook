import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { AppShell } from "@/components/app-shell/app-shell";
import { BusinessProvider } from "@/components/app-shell/business-context";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [business] = await db
    .select({
      name: businesses.name,
      logoUrl: businesses.logoUrl,
      defaultCurrency: businesses.defaultCurrency,
      invoicePrefix: businesses.invoicePrefix,
    })
    .from(businesses)
    .where(eq(businesses.id, user.businessId))
    .limit(1);

  return (
    <BusinessProvider
      value={{
        name: business?.name ?? "Your business",
        currency: business?.defaultCurrency ?? "USD",
        invoicePrefix: business?.invoicePrefix ?? "INV",
        logoUrl: business?.logoUrl ?? null,
        role: user.role,
      }}
    >
      <AppShell
        user={{ name: user.name, email: user.email, role: user.role }}
        business={{
          name: business?.name ?? "Your business",
          logoUrl: business?.logoUrl ?? null,
        }}
      >
        {children}
      </AppShell>
    </BusinessProvider>
  );
}
