import "server-only";
import { randomUUID } from "node:crypto";
import { put, issueSignedToken, presignUrl } from "@vercel/blob";
import { env } from "@/env";

export type UploadedProof = {
  blobKey: string; // pathname within the store
  url: string;
  fileName: string;
  contentType: string;
};

/** Strip anything that could break a blob pathname; keep a readable name. */
function safeName(name: string): string {
  const cleaned = name
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : "file";
}

/**
 * Upload a payment proof to a PRIVATE blob under
 * `proofs/${businessId}/${uuid}-${filename}`. Private blobs require a signed
 * URL to read back (see `signedProofUrl`).
 */
export async function uploadProof(
  file: File,
  businessId: string,
): Promise<UploadedProof> {
  const key = `proofs/${businessId}/${randomUUID()}-${safeName(file.name)}`;
  const res = await put(key, file, {
    access: "private",
    token: env.BLOB_READ_WRITE_TOKEN,
    contentType: file.type,
    addRandomSuffix: false,
  });
  return {
    blobKey: res.pathname,
    url: res.url,
    fileName: file.name,
    contentType: file.type,
  };
}

/**
 * Return a short-lived (5 min) signed URL that grants read access to a private
 * proof blob. Two-step: issue a delegation token scoped to the pathname, then
 * presign a GET URL from it.
 */
export async function signedProofUrl(
  blobKey: string,
  ttlMs = 5 * 60 * 1000,
): Promise<string> {
  const validUntil = Date.now() + ttlMs;
  const token = await issueSignedToken({
    pathname: blobKey,
    operations: ["get"],
    validUntil,
    token: env.BLOB_READ_WRITE_TOKEN,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname: blobKey,
    access: "private",
    validUntil,
  });
  return presignedUrl;
}

/**
 * Upload a business logo to a PUBLIC blob under `logos/${businessId}/...`.
 * Logos are non-sensitive and rendered directly by the browser and PDF, so
 * public access with a random suffix is appropriate.
 */
export async function uploadLogo(
  file: File,
  businessId: string,
): Promise<{ url: string }> {
  const key = `logos/${businessId}/${randomUUID()}-${safeName(file.name)}`;
  const res = await put(key, file, {
    access: "public",
    token: env.BLOB_READ_WRITE_TOKEN,
    contentType: file.type,
    addRandomSuffix: false,
  });
  return { url: res.url };
}
