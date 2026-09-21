"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginHeading />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginHeading() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Sign in to continue to your workspace.
      </p>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  function validate() {
    const errs: typeof fieldErrors = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setStatus("loading");
    const { error } = await signIn.email({ email: email.trim(), password });
    if (error) {
      setStatus("idle");
      setFormError(
        error.message ||
          "We couldn't sign you in. Check your email and password.",
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Sign in to continue to your workspace.
      </p>

      {formError ? (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <Field label="Email" required error={fieldErrors.email}>
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@company.com"
              value={email}
              invalid={Boolean(fieldErrors.email)}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "loading"}
            />
          )}
        </Field>

        <Field label="Password" required error={fieldErrors.password}>
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              invalid={Boolean(fieldErrors.password)}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === "loading"}
            />
          )}
        </Field>

        <Button
          type="submit"
          size="lg"
          loading={status === "loading"}
          disabled={status === "loading"}
          className="mt-1 w-full"
        >
          {status === "loading" ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New to InvoiceBook?{" "}
        <Link
          href="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
