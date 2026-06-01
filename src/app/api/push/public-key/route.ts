import { NextResponse } from "next/server"
import { getPublicKey } from "@/lib/push"

export const dynamic = "force-dynamic"

export async function GET() {
  const key = getPublicKey()
  if (!key) {
    return NextResponse.json(
      { error: "Push notifications não configuradas no servidor" },
      { status: 503 }
    )
  }
  return NextResponse.json({ publicKey: key })
}
