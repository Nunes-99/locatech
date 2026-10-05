// Quantas diárias há entre a retirada e a devolução prevista. É o servidor que
// conta: antes o total vinha do "days" enviado pela tela, e um aluguel de 30
// dias com o campo esquecido em 1 era cobrado como 1 diária.
// Fração de dia conta como diária cheia (devolveu 1h depois = mais uma diária).
export function contarDiarias(inicio: Date, fim: Date): number {
  const ms = fim.getTime() - inicio.getTime()
  return Math.max(1, Math.ceil(ms / 86_400_000))
}

// Data de calendário (AAAA-MM-DD) de um instante no horário de Brasília
function dataEmBrasilia(instante: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(instante)
}

// Dias de atraso entre a devolução prevista e a real, contando o calendário.
// A prevista é a data gravada (AAAA-MM-DD em UTC, como veio do formulário);
// devolver no próprio dia = 0; no dia seguinte = 1.
export function diasDeAtraso(previsto: Date, devolvido: Date): number {
  const dataPrevista = previsto.toISOString().slice(0, 10)
  const dataDevolvida = dataEmBrasilia(devolvido)
  const dias = Math.round((Date.parse(dataDevolvida) - Date.parse(dataPrevista)) / 86_400_000)
  return Math.max(0, dias)
}
