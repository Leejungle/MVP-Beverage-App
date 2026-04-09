import { PrismaClient } from "../../generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// @prisma/adapter-libsql supports both local SQLite files and remote Turso databases:
//   Local dev:  TURSO_DATABASE_URL unset → falls back to "file:./dev.db"
//   Production: TURSO_DATABASE_URL = "libsql://xxx.turso.io" + TURSO_AUTH_TOKEN

function createPrismaClient() {
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return new PrismaClient({ adapter });
}

type PrismaInstance = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma: PrismaInstance };

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
