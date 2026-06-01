import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

interface CheckResult {
  status: "ok" | "error" | "skipped"
  latencyMs?: number
  detail?: string
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
  const t0 = Date.now()
  const result = await fn()
  return { result, latencyMs: Date.now() - t0 }
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    const { latencyMs } = await timed(() => prisma.$queryRaw`SELECT 1`)
    return { status: "ok", latencyMs }
  } catch (error) {
    return { status: "error", detail: (error as Error).message }
  }
}

async function checkResend(): Promise<CheckResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { status: "skipped", detail: "RESEND_API_KEY ausente" }

  try {
    const t0 = Date.now()
    // GET /domains é leve e valida a key sem disparar email
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - t0
    if (!response.ok) {
      return { status: "error", latencyMs, detail: `Resend ${response.status}` }
    }
    return { status: "ok", latencyMs }
  } catch (error) {
    return { status: "error", detail: (error as Error).message }
  }
}

async function checkMercadoPago(): Promise<CheckResult> {
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) return { status: "skipped", detail: "MP_ACCESS_TOKEN ausente" }

  try {
    const t0 = Date.now()
    // GET /users/me valida o token sem efeitos colaterais
    const response = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - t0
    if (!response.ok) {
      return { status: "error", latencyMs, detail: `MP ${response.status}` }
    }
    return { status: "ok", latencyMs }
  } catch (error) {
    return { status: "error", detail: (error as Error).message }
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const { searchParams } = new URL(request.url)
  const detailed = searchParams.get("detailed") === "1"

  // DB é sempre obrigatório. Checks externos rodam só em modo detailed (precisa de network).
  // Isso evita timeout/custo em probes simples (Vercel, UptimeRobot batendo a cada 1min).
  const checks: Record<string, CheckResult> = {}

  checks.database = await checkDatabase()

  if (detailed) {
    const [resend, mp] = await Promise.all([checkResend(), checkMercadoPago()])
    checks.resend = resend
    checks.mercadopago = mp
  }

  // Saúde geral: ok se DB OK e nenhum check externo em erro (skipped não conta)
  const hasError = Object.values(checks).some((c) => c.status === "error")

  return NextResponse.json(
    {
      status: hasError ? "degraded" : "ok",
      uptime: process.uptime ? Math.round(process.uptime()) : null,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      checks,
    },
    {
      status: hasError ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
