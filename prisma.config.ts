import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved the connection URL out of schema.prisma; the CLI reads it from
 * here. The *runtime* client is separate — src/lib/db.ts builds its own
 * PrismaPg adapter, so this file only serves migrate / db push / studio.
 *
 * `.env.local` is a Next.js convention that Prisma does not know about, so it
 * is loaded explicitly. Without this every db:* script needs the var exported
 * by hand.
 */
loadEnv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: { path: path.join("prisma", "migrations") },
  datasource: { url: process.env.DATABASE_URL as string },
});
