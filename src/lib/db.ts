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

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
