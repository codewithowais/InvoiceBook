"use client";

import { createContext, useContext } from "react";

export type BusinessInfo = {
  name: string;
  currency: string;
  invoicePrefix: string;
  logoUrl: string | null;
  role: "admin" | "staff";
};

const BusinessContext = createContext<BusinessInfo | null>(null);

export function BusinessProvider({
  value,
  children,
}: {
  value: BusinessInfo;
  children: React.ReactNode;
}) {
  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness(): BusinessInfo {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    // Safe fallback so a component never crashes if used outside the shell.
    return {
      name: "Your business",
      currency: "USD",
      invoicePrefix: "INV",
      logoUrl: null,
      role: "staff",
    };
  }
  return ctx;
}
