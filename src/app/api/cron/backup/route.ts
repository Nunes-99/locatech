import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

/**
 * Endpoint cron pra disparar backup do banco.
 *
 * **Cuidado:** em hospedagem serverless (Vercel) isso NÃO funciona — pg_dump
 * não está disponível e o filesystem é efêmero. Use só em VM dedicada (Oracle/AWS EC2).
 *
 * Em serverless, use cron externo (GitHub Actions, n8n, cron-job.org) que dispara
 * o script `scripts/backup.sh` num runner com acesso ao DB.
 *
 * Frequência sugerida em vercel.json: 1x/dia. Mas pra serverless o melhor é
 * delegar pro provider gerenciado (Neon/Supabase têm backup automático).
 */
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { verifyCronSecret } = await import("@/lib/cron-auth")
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Detecta se está em serverless — se sim, retorna informativo
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return NextResponse.json({
      skipped: true,
      reason: "Backup via pg_dump não suporta serverless. Use Neon/Supabase backup ou cron em VM dedicada.",
    })
  }

  try {
    const { stdout, stderr } = await execAsync("bash scripts/backup.sh", {
      env: { ...process.env },
      timeout: 10 * 60 * 1000, // 10 min
    })

    return NextResponse.json({
      success: true,
      stdout: stdout.split("\n").slice(-10).join("\n"),
      stderr: stderr.slice(0, 500),
    })
  } catch (error) {
    console.error("[backup cron] error:", error)
    return NextResponse.json(
      { error: "Backup falhou", detail: (error as Error).message.slice(0, 500) },
      { status: 500 }
    )
  }
}
