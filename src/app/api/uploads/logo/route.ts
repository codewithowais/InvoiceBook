import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { uploadLogo } from "@/lib/blob";

export const runtime = "nodejs";

const ALLOWED = ["image/png", "image/jpeg"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export const POST = handler(async (req: Request) => {
  const user = await requireUser();

  const { allowed, retryAfter } = checkRateLimit(
    `${user.id}:upload-logo`,
    20,
    60_000,
  );
  if (!allowed) {
    return fail(`Too many uploads, retry in ${retryAfter}s`, 429);
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail("No file provided (expected multipart field 'file')", 400);
  }
  if (!ALLOWED.includes(file.type)) {
    return fail("Unsupported file type. Allowed: PNG, JPEG.", 400);
  }
  if (file.size > MAX_BYTES) {
    return fail("File too large. Maximum size is 5MB.", 400);
  }

  const result = await uploadLogo(file, user.businessId);
  return ok(result, 201);
});
