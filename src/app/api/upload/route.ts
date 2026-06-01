import { NextRequest, NextResponse } from "next/server"
import { requireCompanyId } from "@/lib/session"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { v4 as uuid } from "uuid"
import sharp from "sharp"

const UPLOAD_DIR = join(process.cwd(), "public", "uploads")

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10MB no input (depois comprime)
const MAX_DIMENSION = 1600 // px
const JPEG_QUALITY = 80
const WEBP_QUALITY = 80

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

export async function POST(request: NextRequest) {
  try {
    await requireCompanyId()

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF." },
        { status: 400 }
      )
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Máximo ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.` },
        { status: 400 }
      )
    }

    try {
      await mkdir(UPLOAD_DIR, { recursive: true })
    } catch {
      /* já existe */
    }

    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)

    let outputBuffer: Buffer
    let outputExt: string
    let outputMime: string

    // GIF preserva como está (pode ser animado — sharp aplainaria)
    if (file.type === "image/gif") {
      outputBuffer = inputBuffer
      outputExt = "gif"
      outputMime = "image/gif"
    } else {
      // PNG e WebP com transparência → mantém PNG; senão converte pra JPEG
      const meta = await sharp(inputBuffer).metadata()
      const hasAlpha = !!meta.hasAlpha

      const pipeline = sharp(inputBuffer).rotate() // EXIF orientation
      const needsResize = (meta.width ?? 0) > MAX_DIMENSION || (meta.height ?? 0) > MAX_DIMENSION
      if (needsResize) {
        pipeline.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside" })
      }

      if (hasAlpha) {
        outputBuffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer()
        outputExt = "webp"
        outputMime = "image/webp"
      } else {
        outputBuffer = await pipeline
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toBuffer()
        outputExt = "jpg"
        outputMime = "image/jpeg"
      }
    }

    const fileName = `${uuid()}.${outputExt}`
    const filePath = join(UPLOAD_DIR, fileName)
    await writeFile(filePath, outputBuffer)

    const url = `/uploads/${fileName}`

    return NextResponse.json({
      url,
      fileName,
      mimeType: outputMime,
      bytes: outputBuffer.length,
      original: { bytes: inputBuffer.length, mimeType: file.type },
    })
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
