import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail, getOverdueNotificationEmail, getRentalReminderEmail } from "@/lib/notifications/email"

// This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions)
// Recommended: Run daily at midnight

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (for security)
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // 1. Find overdue rentals and update late fees
    const overdueRentals = await prisma.rental.findMany({
      where: {
        deletedAt: null,
        status: { in: ["IN_PROGRESS", "OVERDUE"] },
        expectedEndDate: { lt: today },
        actualEndDate: null,
      },
      include: {
        customer: true,
        company: true,
        items: true,
      },
    })

    const updates = []
    const notifications = []

    for (const rental of overdueRentals) {
      const endDate = new Date(rental.expectedEndDate)
      const diffTime = today.getTime() - endDate.getTime()
      const lateDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Calculate late fee (% per day based on company settings)
      const lateFeePercent = Number(rental.company.lateFeePercent)
      const dailyFee = (Number(rental.total) * lateFeePercent) / 100
      const totalLateFee = dailyFee * lateDays

      // Update rental
      updates.push(
        prisma.rental.update({
          where: { id: rental.id },
          data: {
            status: "OVERDUE",
            lateDays,
            lateFee: totalLateFee,
            paymentStatus: "OVERDUE",
          },
        })
      )

      // Send notification if customer has email
      if (rental.customer.email) {
        const emailData = getOverdueNotificationEmail({
          customerName: rental.customer.name,
          contractNumber: rental.contractNumber,
          daysOverdue: lateDays,
          equipmentList: rental.items
            .map((item) => `${item.equipmentName} (${item.equipmentCode})`)
            .join(", "),
          lateFee: totalLateFee,
          companyName: rental.company.name,
          companyPhone: rental.company.phone || "",
        })

        notifications.push(
          sendEmail({
            to: rental.customer.email,
            subject: emailData.subject,
            html: emailData.html,
          })
        )
      }
    }

    // 2. Find rentals ending in 1-3 days and send reminders
    const reminderDate1 = new Date(today)
    reminderDate1.setDate(reminderDate1.getDate() + 1)

    const reminderDate3 = new Date(today)
    reminderDate3.setDate(reminderDate3.getDate() + 3)

    const upcomingRentals = await prisma.rental.findMany({
      where: {
        deletedAt: null,
        status: "IN_PROGRESS",
        expectedEndDate: {
          gte: reminderDate1,
          lte: reminderDate3,
        },
        actualEndDate: null,
      },
      include: {
        customer: true,
        company: true,
      },
    })

    for (const rental of upcomingRentals) {
      const endDate = new Date(rental.expectedEndDate)
      const diffTime = endDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Only send reminder for 1 and 3 days
      if (daysRemaining === 1 || daysRemaining === 3) {
        if (rental.customer.email) {
          const emailData = getRentalReminderEmail({
            customerName: rental.customer.name,
            contractNumber: rental.contractNumber,
            endDate: endDate.toLocaleDateString("pt-BR"),
            daysRemaining,
            companyName: rental.company.name,
          })

          notifications.push(
            sendEmail({
              to: rental.customer.email,
              subject: emailData.subject,
              html: emailData.html,
            })
          )
        }
      }
    }

    // Execute all updates and notifications
    await Promise.all([...updates, ...notifications])

    return NextResponse.json({
      success: true,
      processed: {
        overdueRentals: overdueRentals.length,
        reminders: upcomingRentals.length,
      },
    })
  } catch (error) {
    console.error("Error processing late fees:", error)
    return NextResponse.json(
      { error: "Erro ao processar multas" },
      { status: 500 }
    )
  }
}
