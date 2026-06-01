import { PrismaClient } from "@prisma/client"
import { auditExtension } from "./audit"

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined
  prisma: ReturnType<typeof buildPrisma> | undefined
}

function buildPrisma() {
  const base =
    globalForPrisma.prismaBase ??
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    })

  if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = base
  return auditExtension(base)
}

export const prisma = globalForPrisma.prisma ?? buildPrisma()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
