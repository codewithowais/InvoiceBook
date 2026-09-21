"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  function validate() {
    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = "Your name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    else if (password.length < 8)
      errs.password = "Use at least 8 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setStatus("loading");
    const { error } = await signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    if (error) {
      setStatus("idle");
      setFormError(
        error.message ||
          "We couldn't create your account. That email may already be in use.",
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const passwordStrong = password.length >= 8;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Create your workspace
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        Sign up and we&apos;ll set up your business automatically.
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
        <Field label="Full name" required error={fieldErrors.name}>
          {(props) => (
            <Input
              {...props}
              type="text"
              autoComplete="name"
              placeholder="Jordan Rivera"
              value={name}
              invalid={Boolean(fieldErrors.name)}
              onChange={(e) => setName(e.target.value)}
              disabled={status === "loading"}
            />
          )}
        </Field>

        <Field label="Work email" required error={fieldErrors.email}>
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

        <Field
          label="Password"
          required
          error={fieldErrors.password}
          hint={
            <span
              className={
                passwordStrong ? "inline-flex items-center gap-1 text-success" : ""
              }
            >
              {passwordStrong ? <Check className="size-3" aria-hidden /> : null}
              At least 8 characters
            </span>
          }
        >
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
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
          {status === "loading" ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
