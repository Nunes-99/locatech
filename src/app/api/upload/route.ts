import { NextRequest, NextResponse } from "next/server"
import { requireCompanyId } from "@/lib/session"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { v4 as uuid } from "uuid"

const UPLOAD_DIR = join(process.cwd(), "public", "uploads")

export async function POST(request: NextRequest) {
  try {
    await requireCompanyId()

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    // Validar tipo de arquivo
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF." },
        { status: 400 }
      )
    }

    // Validar tamanho (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Máximo 5MB." },
        { status: 400 }
      )
    }

    // Criar diretório se não existir
    try {
      await mkdir(UPLOAD_DIR, { recursive: true })
    } catch {
      // Diretório já existe
    }

    // Gerar nome único
    const ext = file.name.split(".").pop()
    const fileName = `${uuid()}.${ext}`
    const filePath = join(UPLOAD_DIR, fileName)

    // Salvar arquivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    const url = `/uploads/${fileName}`

    return NextResponse.json({ url, fileName })
  } catch (error) {
    console.error("Error uploading file:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao fazer upload do arquivo" },
      { status: 500 }
    )
  }
}
