import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
  migrate: {
    adapter: async () => {
      const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
      return new PrismaLibSql({
        url,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    },
  },
});
