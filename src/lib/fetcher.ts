/**
 * Typed fetch wrapper for InvoiceBook's JSON API.
 *
 * The backend responds with `{ data }` on success and `{ error, details? }`
 * on failure (see docs/BACKEND.md). `api()` unwraps `data` on success and
 * throws an `ApiError` (carrying the message, status, and Zod field details)
 * on failure so callers can `try/catch` and surface friendly messages.
 *
 * This file is owned by the frontend (added per the build brief); it does not
 * touch any frozen lib.
 */

export class ApiError extends Error {
  status: number;
  /** Zod fieldErrors from a 422, keyed by field name. */
  details?: Record<string, string[]> | unknown;

  constructor(
    message: string,
    status: number,
    details?: Record<string, string[]> | unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  /** Flatten Zod field errors into a simple { field: message } map. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    const d = this.details as Record<string, string[]> | undefined;
    if (d && typeof d === "object") {
      for (const [key, val] of Object.entries(d)) {
        if (Array.isArray(val) && val[0]) out[key] = val[0];
      }
    }
    return out;
  }
}

type Json = Record<string, unknown>;

async function parse<T>(res: Response): Promise<T> {
  let body: Json = {};
  try {
    body = (await res.json()) as Json;
  } catch {
    // Non-JSON response (e.g. a 500 HTML page)
  }

  if (!res.ok || "error" in body) {
    const message =
      (typeof body.error === "string" && body.error) ||
      res.statusText ||
      "Something went wrong. Please try again.";
    throw new ApiError(message, res.status, body.details);
  }

  return body.data as T;
}

export type ApiInit = Omit<RequestInit, "body"> & { body?: unknown };

/** Core JSON call. Pass a plain object as `body`; it is JSON-stringified. */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { body, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parse<T>(res);
}

export const apiGet = <T>(path: string, init?: ApiInit) =>
  api<T>(path, { ...init, method: "GET" });

export const apiPost = <T>(path: string, body?: unknown, init?: ApiInit) =>
  api<T>(path, { ...init, method: "POST", body });

export const apiPatch = <T>(path: string, body?: unknown, init?: ApiInit) =>
  api<T>(path, { ...init, method: "PATCH", body });

export const apiDelete = <T>(path: string, init?: ApiInit) =>
  api<T>(path, { ...init, method: "DELETE" });

/**
 * Normalize a list payload: some endpoints return a bare array, others a
 * `{ items: [...] }` page object. Always yields an array.
 */
export function asArray<T>(value: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.items)) return value.items;
  return [];
}

export type UploadResult = {
  blobKey: string;
  url: string;
  fileName: string;
  contentType: string;
};

/**
 * Multipart upload helper. Sends a single file under `field` (default "file")
 * to an uploads endpoint and returns the `{ blobKey, url, fileName,
 * contentType }` payload.
 */
export async function uploadFile(
  path: string,
  file: File,
  field = "file",
): Promise<UploadResult> {
  const form = new FormData();
  form.append(field, file);
  const res = await fetch(path, { method: "POST", body: form });
  return parse<UploadResult>(res);
}
