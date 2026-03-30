import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail, getOverdueNotificationEmail } from "@/lib/notifications/email"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find all rentals that are ending today
    const endingToday = await prisma.rental.findMany({
      where: {
        status: "IN_PROGRESS",
        expectedEndDate: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: {
        customer: true,
        company: true,
        items: {
          include: {
            equipment: true,
          },
        },
      },
    })

    // Find all overdue rentals
    const overdueRentals = await prisma.rental.findMany({
      where: {
        status: {
          in: ["IN_PROGRESS", "OVERDUE"],
        },
        expectedEndDate: {
          lt: today,
        },
      },
      include: {
        customer: true,
        company: true,
        items: {
          include: {
            equipment: true,
          },
        },
      },
    })

    const results = {
      endingTodayNotified: 0,
      overdueNotified: 0,
      notifications: 0,
    }

    // Send reminders for rentals ending today
    for (const rental of endingToday) {
      if (rental.customer.email) {
        const equipmentList = rental.items
          .map((item) => `${item.equipmentName} (${item.equipmentCode})`)
          .join(", ")

        await sendEmail({
          to: rental.customer.email,
          subject: `Lembrete: Devolução hoje - ${rental.company.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Olá, ${rental.customer.name}!</h2>
              <p>Este é um lembrete de que a locação abaixo deve ser devolvida <strong>hoje</strong>:</p>
              <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p><strong>Contrato:</strong> #${rental.contractNumber}</p>
                <p><strong>Equipamentos:</strong> ${equipmentList}</p>
                <p><strong>Data de devolução:</strong> ${new Date(rental.expectedEndDate).toLocaleDateString("pt-BR")}</p>
              </div>
              <p>Caso não seja possível devolver hoje, entre em contato conosco para renovar a locação.</p>
              <p style="color: #666; font-size: 12px; margin-top: 24px;">
                ${rental.company.name}<br>
                ${rental.company.phone || ""}
              </p>
            </div>
          `,
        })
        results.endingTodayNotified++
      }
    }

    // Send notifications for overdue rentals
    for (const rental of overdueRentals) {
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(rental.expectedEndDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )

      // Update status to OVERDUE if not already
      if (rental.status !== "OVERDUE") {
        await prisma.rental.update({
          where: { id: rental.id },
          data: { status: "OVERDUE", lateDays: daysOverdue },
        })
      }

      // Only send email every 3 days to avoid spamming
      if (daysOverdue === 1 || daysOverdue % 3 === 0) {
        if (rental.customer.email) {
          const emailContent = getOverdueNotificationEmail({
            customerName: rental.customer.name,
            contractNumber: rental.contractNumber,
            daysOverdue,
            equipmentList: rental.items
              .map((item) => `${item.equipmentName} (${item.equipmentCode})`)
              .join(", "),
            lateFee: rental.lateFee.toNumber(),
            companyName: rental.company.name,
            companyPhone: rental.company.phone || "",
          })

          await sendEmail({
            to: rental.customer.email,
            subject: emailContent.subject,
            html: emailContent.html,
          })
          results.overdueNotified++
        }
      }

      // Create in-app notification for company
      await prisma.notification.create({
        data: {
          companyId: rental.companyId,
          title: "Locação em atraso",
          message: `Cliente ${rental.customer.name} - Contrato #${rental.contractNumber} está ${daysOverdue} dia(s) em atraso.`,
          type: "WARNING",
          link: `/locacoes/${rental.id}`,
        },
      })
      results.notifications++
    }

    return NextResponse.json({
      success: true,
      endingToday: endingToday.length,
      overdue: overdueRentals.length,
      ...results,
    })
  } catch (error) {
    console.error("Overdue reminders cron error:", error)
    return NextResponse.json(
      { error: "Failed to process overdue reminders" },
      { status: 500 }
    )
  }
}
