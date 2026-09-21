/**
 * Runtime environment access with clear, fail-fast errors.
 * We intentionally read at call time (not module load) so `next build`
 * — which does not touch the database — never fails on a missing secret.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get BETTER_AUTH_SECRET() {
    return required("BETTER_AUTH_SECRET");
  },
  get BETTER_AUTH_URL() {
    return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  },
  get BLOB_READ_WRITE_TOKEN() {
    return required("BLOB_READ_WRITE_TOKEN");
  },
  get CRON_SECRET() {
    return required("CRON_SECRET");
  },
  get APP_URL() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },
};
