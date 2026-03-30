import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCompanyId, getCurrentUser } from "@/lib/session"
import { renderToBuffer } from "@react-pdf/renderer"
import { RentalContractPDF } from "@/components/contracts/rental-contract-pdf"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await requireCompanyId()
    const user = await getCurrentUser()
    const { id } = await params

    // Buscar locacao com todos os dados necessarios
    const rental = await prisma.rental.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
        items: true,
        company: true,
      },
    })

    if (!rental) {
      return NextResponse.json(
        { error: "Locacao nao encontrada" },
        { status: 404 }
      )
    }

    // Preparar dados do contrato
    const contractData = {
      contractNumber: rental.contractNumber,
      companyName: rental.company.name,
      companyDocument: rental.company.document || undefined,
      companyAddress: rental.company.address || undefined,
      companyPhone: rental.company.phone || undefined,
      customerName: rental.customer.name,
      customerDocument: rental.customer.document,
      customerPhone: rental.customer.phone,
      customerAddress: rental.customer.address || undefined,
      startDate: rental.startDate.toISOString(),
      expectedEndDate: rental.expectedEndDate.toISOString(),
      type: rental.type as "DELIVERY" | "PICKUP",
      deliveryAddress: rental.deliveryAddress || undefined,
      items: rental.items.map((item) => ({
        equipmentCode: item.equipmentCode,
        equipmentName: item.equipmentName,
        dailyRate: Number(item.dailyRate),
        days: item.days,
        subtotal: Number(item.subtotal),
      })),
      subtotal: Number(rental.subtotal),
      deliveryFee: Number(rental.deliveryFee),
      depositAmount: Number(rental.depositAmount),
      total: Number(rental.total),
      notes: rental.notes || undefined,
    }

    // Gerar PDF
    const pdfBuffer = await renderToBuffer(
      RentalContractPDF({ data: contractData }) as any
    )

    // Retornar PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="contrato-LOC-${rental.contractNumber.toString().padStart(4, "0")}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Error generating contract:", error)
    if (error instanceof Error && error.message === "Nao autorizado") {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }
    return NextResponse.json(
      { error: "Erro ao gerar contrato" },
      { status: 500 }
    )
  }
}
