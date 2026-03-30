import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, getSession } from "@/lib/session"
import { z } from "zod"

const createNotificationSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(["INFO", "WARNING", "ERROR", "SUCCESS"]).default("INFO"),
  link: z.string().optional(),
  userId: z.string().optional(), // If not provided, notification is for all users in company
})

export async function GET(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const unreadOnly = searchParams.get("unread") === "true"
    const limit = parseInt(searchParams.get("limit") || "20")

    const where = {
      companyId,
      OR: [
        { userId: session.user.id },
        { userId: null }, // Company-wide notifications
      ],
      ...(unreadOnly && { read: false }),
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    const unreadCount = await prisma.notification.count({
      where: {
        ...where,
        read: false,
      },
    })

    return NextResponse.json({
      notifications,
      unreadCount,
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    if (error instanceof Error && error.message === "Não autorizado") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao buscar notificações" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await requireCompanyId()
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const data = createNotificationSchema.parse(body)

    const notification = await prisma.notification.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link,
        userId: data.userId,
        companyId,
      },
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    console.error("Error creating notification:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Erro ao criar notificação" },
      { status: 500 }
    )
  }
}
