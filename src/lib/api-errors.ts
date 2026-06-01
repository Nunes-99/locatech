import { NextResponse } from "next/server"
import { ZodError } from "zod"

/**
 * Helper compartilhado pra tratar erros comuns de API routes.
 *
 * O padrão `if (err.message === "Não autorizado") ...` aparecia repetido em
 * ~15 rotas. Este helper consolida o tratamento e adiciona:
 *   - Erros do Zod → 400 com detalhes
 *   - Mensagens de auth/permission → 401/403
 *   - Outros → 500 com log
 *
 * Uso:
 *
 *   } catch (error) {
 *     return handleApiError(error, "Erro ao buscar equipamento")
 *   }
 */
export function handleApiError(error: unknown, fallbackMessage = "Erro interno"): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.errors[0]?.message || "Dados inválidos",
        details: error.errors,
      },
      { status: 400 }
    )
  }

  if (error instanceof Error) {
    const status = (error as Error & { status?: number }).status
    if (error.message === "Não autorizado" || error.message === "Nao autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    if (status === 403 || error.message === "Acesso negado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }
  }

  console.error("[api]", fallbackMessage, ":", error)
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}

/**
 * Helper só pros casos onde o caller já tratou outros erros e só quer reagir
 * a auth/permission. Retorna NextResponse se for caso de auth/permission,
 * `null` caso contrário — caller decide o que fazer.
 *
 * Útil quando há lógica específica de erro acima e só queremos delegar o caso
 * comum sem mascarar.
 */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) return null
  const status = (error as Error & { status?: number }).status
  if (error.message === "Não autorizado" || error.message === "Nao autorizado") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (status === 403 || error.message === "Acesso negado") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  return null
}
