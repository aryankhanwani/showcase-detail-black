import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 talks to Postgres through a driver adapter rather than its own
 * engine binary, so the connection string is supplied here rather than in
 * schema.prisma.
 *
 * The client is cached on globalThis because Next.js re-evaluates modules on
 * every hot reload in development; without this, each save opens a fresh pool
 * and Postgres runs out of connections within a few minutes of editing.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and start Postgres with `docker compose up -d`.",
    );
  }

  /*
   * Pool sizing is the one thing that differs between a long-lived server and
   * a serverless deployment. On Vercel every concurrent invocation is its own
   * process with its own pool, so a default pool of 10 becomes 10 × however
   * many lambdas are warm — which exhausts Postgres' connection limit long
   * before the traffic justifies it. One connection per invocation is correct
   * there, and the platform's own pooler does the multiplexing.
   *
   * Use the POOLED connection string on serverless (Neon's `-pooler` host, or
   * Supabase's pgBouncer port 6543). The direct URL is for migrations only.
   */
  const serverless = Boolean(process.env.VERCEL);

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: serverless ? 1 : 10,
      idleTimeoutMillis: serverless ? 10_000 : 30_000,
      connectionTimeoutMillis: 10_000,
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
