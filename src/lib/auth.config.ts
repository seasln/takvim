import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

/** Minimal config for `npx @better-auth/cli generate` only. */
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? "generate-cli-placeholder",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter({} as never, { provider: "pg" }),
  emailAndPassword: { enabled: true },
});
