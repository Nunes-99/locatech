import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail, getMaintenanceAlertEmail } from "@/lib/notifications/email"

// This endpoint should be called by a cron job
// Recommended: Run daily at 8am

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Find maintenances scheduled for today or tomorrow
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const upcomingMaintenances = await prisma.maintenance.findMany({
      where: {
        status: "SCHEDULED",
        scheduledDate: {
          gte: today,
          lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000), // day after tomorrow
        },
      },
      include: {
        equipment: true,
        company: {
          include: {
            users: {
              where: { role: { in: ["OWNER", "ADMIN"] } },
              select: { email: true, name: true },
            },
          },
        },
      },
    })

    const notifications = []

    for (const maintenance of upcomingMaintenances) {
      const maintenanceTypes: Record<string, string> = {
        PREVENTIVE: "Preventiva",
        CORRECTIVE: "Corretiva",
        INSPECTION: "Inspeção",
      }

      // Send to all admins/owners of the company
      for (const user of maintenance.company.users) {
        const emailData = getMaintenanceAlertEmail({
          userName: user.name,
          equipmentCode: maintenance.equipment.code,
          equipmentName: maintenance.equipment.name,
          maintenanceType: maintenanceTypes[maintenance.type] || maintenance.type,
          scheduledDate: maintenance.scheduledDate
            ? new Date(maintenance.scheduledDate).toLocaleDateString("pt-BR")
            : "Não definida",
          companyName: maintenance.company.name,
        })

        notifications.push(
          sendEmail({
            to: user.email,
            subject: emailData.subject,
            html: emailData.html,
          })
        )
      }
    }

    // Also check for equipment that need preventive maintenance
    // based on usage (e.g., every 100 rentals or 500 days rented)
    const equipmentNeedingMaintenance = await prisma.equipment.findMany({
      where: {
        status: { in: ["AVAILABLE", "RENTED"] },
        OR: [
          { totalRentals: { gte: 100 } }, // More than 100 rentals
          { totalDaysRented: { gte: 365 } }, // More than 365 days rented
        ],
        // Exclude equipment that already have scheduled maintenance
        maintenances: {
          none: {
            status: "SCHEDULED",
            type: "PREVENTIVE",
          },
        },
      },
      include: {
        company: {
          include: {
            users: {
              where: { role: { in: ["OWNER", "ADMIN"] } },
              select: { email: true, name: true },
            },
          },
        },
      },
    })

    // Create maintenance alerts for equipment that needs it
    for (const equipment of equipmentNeedingMaintenance) {
      // Create a scheduled preventive maintenance
      await prisma.maintenance.create({
        data: {
          companyId: equipment.companyId,
          equipmentId: equipment.id,
          type: "PREVENTIVE",
          title: `Manutenção preventiva - ${equipment.code}`,
          description: `Manutenção preventiva automática baseada no uso do equipamento (${equipment.totalRentals} locações, ${equipment.totalDaysRented} dias alugado).`,
          laborCost: 0,
          partsCost: 0,
          totalCost: 0,
          scheduledDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // Schedule for 7 days from now
          status: "SCHEDULED",
        },
      })

      // Notify admins
      for (const user of equipment.company.users) {
        const emailData = getMaintenanceAlertEmail({
          userName: user.name,
          equipmentCode: equipment.code,
          equipmentName: equipment.name,
          maintenanceType: "Preventiva (Automática)",
          scheduledDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR"),
          companyName: equipment.company.name,
        })

        notifications.push(
          sendEmail({
            to: user.email,
            subject: emailData.subject,
            html: emailData.html,
          })
        )
      }
    }

    await Promise.all(notifications)

    return NextResponse.json({
      success: true,
      processed: {
        upcomingMaintenances: upcomingMaintenances.length,
        autoCreatedMaintenances: equipmentNeedingMaintenance.length,
      },
    })
  } catch (error) {
    console.error("Error processing maintenance alerts:", error)
    return NextResponse.json(
      { error: "Erro ao processar alertas de manutenção" },
      { status: 500 }
    )
  }
}
