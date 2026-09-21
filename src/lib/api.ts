import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/session";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, details: extra }, { status });
}

/**
 * Wraps a route handler so thrown AuthError / ZodError / Error become
 * consistent JSON responses instead of unhandled 500s.
 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AuthError) {
        return fail(err.message, err.status);
      }
      if (err instanceof ZodError) {
        return fail("Validation failed", 422, err.flatten().fieldErrors);
      }
      console.error("[api] unhandled error", err);
      const msg =
        err instanceof Error ? err.message : "Internal server error";
      return fail(msg, 500);
    }
  };
}
