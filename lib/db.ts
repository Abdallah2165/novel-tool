import { PrismaClient } from "@prisma/client";

declare global {
  var __novelToolsPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__novelToolsPrisma ??
  new PrismaClient({
    log: process.env.APP_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.APP_ENV !== "production") {
  global.__novelToolsPrisma = prisma;
}
