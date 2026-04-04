import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js lädt `.env.local` automatisch — drizzle-kit standardmäßig nicht.
config({ path: ".env" });
config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
