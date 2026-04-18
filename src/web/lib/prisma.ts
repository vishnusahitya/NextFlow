import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPgPool: Pool | undefined;
};

const databaseUrl = process.env.DATABASE_URL?.trim();
const usePgAdapter =
  databaseUrl?.startsWith("postgres://") || databaseUrl?.startsWith("postgresql://");

const prismaPgPool =
  usePgAdapter &&
  (globalForPrisma.prismaPgPool ??
    new Pool({
      connectionString: databaseUrl,
    }));

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: prismaPgPool ? new PrismaPg(prismaPgPool) : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  if (prismaPgPool) {
    globalForPrisma.prismaPgPool = prismaPgPool;
  }
}
