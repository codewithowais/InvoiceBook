import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js keeps secrets in .env.local; load it (then .env) for CLI tooling.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
