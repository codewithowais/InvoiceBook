"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { signUp } from "@/lib/auth-client";
import { apiPost, ApiError } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

/**
 * Accept-invite signup form. The email is fixed to the invited address (shown
 * read-only). Signup creates the account, then we call the token-bound accept
 * endpoint — membership is granted by presenting the invite TOKEN, never by
 * email match alone.
 */
export function AcceptInviteForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    password?: string;
  }>({});

  function validate() {
    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = "Your name is required";
    if (!password) errs.password = "Password is required";
    else if (password.length < 8) errs.password = "Use at least 8 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setStatus("loading");
    const { error } = await signUp.email({
      email,
      name: name.trim(),
      password,
    });
    if (error) {
      setStatus("idle");
      setFormError(
        error.message ||
          "We couldn't complete your signup. This invite may have already been used.",
      );
      return;
    }

    // Signed in as the new account; now redeem the invite by its token.
    try {
      await apiPost(`/api/team/invite/${encodeURIComponent(token)}/accept`);
    } catch (err) {
      setStatus("idle");
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Your account was created but joining the team failed. Please try the invite link again.",
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const passwordStrong = password.length >= 8;

  return (
    <>
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
        <Field label="Email">
          {(props) => (
            <Input
              {...props}
              type="email"
              value={email}
              readOnly
              disabled
              autoComplete="email"
            />
          )}
        </Field>

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
          {status === "loading" ? "Joining…" : "Accept invite & join"}
        </Button>
      </form>
    </>
  );
}
