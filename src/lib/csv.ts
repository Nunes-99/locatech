/**
 * Helpers compartilhados para parsing de CSV simples.
 * Suporta separador `,` ou `;`, aspas duplas com escape `""`, e números em pt-BR (`1.234,56`).
 */

export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((ch === "," || ch === ";") && !inQuotes) {
      out.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

export function parseCsvNumber(v: string | undefined): number | undefined {
  if (v === undefined || v === "") return undefined

  // Se tem vírgula → formato BR (pontos são milhares, vírgula é decimal).
  // Se não tem vírgula → confia no ponto como decimal (formato US/internacional)
  //   ou número inteiro sem decimais.
  const normalized = v.includes(",")
    ? v.replace(/\./g, "").replace(",", ".")
    : v

  const n = Number(normalized)
  return isNaN(n) ? undefined : n
}

/**
 * Lê o cabeçalho do CSV e retorna mapa header → índice (case-insensitive).
 * Joga erro se faltar coluna obrigatória.
 */
export function parseCsvHeader(
  headerLine: string,
  knownColumns: readonly string[],
  required: readonly string[]
): Record<string, number> {
  const cells = splitCsvLine(headerLine).map((c) => c.toLowerCase())
  const index: Record<string, number> = {}
  for (const col of knownColumns) {
    const idx = cells.indexOf(col.toLowerCase())
    if (idx !== -1) index[col] = idx
  }
  const missing = required.filter((r) => index[r] === undefined)
  if (missing.length > 0) {
    throw new Error(`Cabeçalho ausente das colunas obrigatórias: ${missing.join(", ")}`)
  }
  return index
}

export function readCsvCell(
  row: string[],
  headerIndex: Record<string, number>,
  key: string
): string | undefined {
  const idx = headerIndex[key]
  if (idx === undefined) return undefined
  return row[idx]
}
