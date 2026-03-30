// WhatsApp integration using Baileys (open source)
// Note: Baileys needs to be installed and configured
// This is a simplified wrapper for the Baileys library

interface WhatsAppMessage {
  to: string // Phone number with country code (e.g., "5511999999999")
  message: string
}

interface WhatsAppConnection {
  isConnected: boolean
  qrCode?: string
}

// In production, this would connect to a real Baileys instance
// For now, we'll create a mock that can be replaced with real implementation
class WhatsAppService {
  private connected: boolean = false

  async connect(): Promise<WhatsAppConnection> {
    // In production, this would initialize Baileys connection
    // and return QR code for authentication
    console.log("WhatsApp: Connecting...")
    return {
      isConnected: false,
      qrCode: "mock-qr-code",
    }
  }

  async sendMessage(options: WhatsAppMessage): Promise<{ success: boolean; error?: string }> {
    if (!this.connected) {
      return { success: false, error: "WhatsApp não conectado" }
    }

    try {
      // In production, this would use Baileys to send the message
      console.log(`WhatsApp: Sending message to ${options.to}`)
      return { success: true }
    } catch (error) {
      console.error("WhatsApp send error:", error)
      return { success: false, error: "Erro ao enviar mensagem" }
    }
  }

  isConnected(): boolean {
    return this.connected
  }
}

export const whatsapp = new WhatsAppService()

// Message templates
export function getRentalConfirmationMessage(data: {
  customerName: string
  contractNumber: number
  startDate: string
  endDate: string
  total: string
  companyName: string
}): string {
  return `
*${data.companyName}*

Olá, ${data.customerName}! 👋

Sua locação foi confirmada com sucesso! ✅

📋 *Contrato:* #${data.contractNumber}
📅 *Período:* ${data.startDate} a ${data.endDate}
💰 *Valor Total:* ${data.total}

Em breve você receberá mais informações sobre a entrega/retirada dos equipamentos.

Qualquer dúvida, estamos à disposição!
`.trim()
}

export function getRentalReminderMessage(data: {
  customerName: string
  contractNumber: number
  endDate: string
  daysRemaining: number
  companyName: string
}): string {
  return `
*${data.companyName}*

⏰ *Lembrete de Devolução*

Olá, ${data.customerName}!

Sua locação (Contrato #${data.contractNumber}) vence em *${data.daysRemaining} dia(s)* (${data.endDate}).

Por favor, providencie a devolução dos equipamentos até a data prevista para evitar multas por atraso.

Precisa estender o período? Entre em contato conosco!
`.trim()
}

export function getOverdueNotificationMessage(data: {
  customerName: string
  contractNumber: number
  endDate: string
  daysLate: number
  lateFee: string
  companyName: string
}): string {
  return `
*${data.companyName}*

🚨 *LOCAÇÃO EM ATRASO*

Olá, ${data.customerName}!

Sua locação (Contrato #${data.contractNumber}) está em atraso há *${data.daysLate} dia(s)*.

📅 Data prevista: ${data.endDate}
💸 Multa acumulada: ${data.lateFee}

Por favor, entre em contato conosco *imediatamente* para regularizar a situação.

A multa é calculada diariamente.
`.trim()
}

export function getMaintenanceAlertMessage(data: {
  equipmentCode: string
  equipmentName: string
  maintenanceType: string
  scheduledDate: string
  companyName: string
}): string {
  return `
*${data.companyName}*

🔧 *Alerta de Manutenção*

Equipamento: ${data.equipmentCode} - ${data.equipmentName}
Tipo: Manutenção ${data.maintenanceType}
Data Agendada: ${data.scheduledDate}

Acesse o sistema para mais detalhes.
`.trim()
}

// Format phone number for WhatsApp (remove special chars, add country code)
export function formatPhoneForWhatsApp(phone: string, countryCode: string = "55"): string {
  const cleaned = phone.replace(/\D/g, "")

  // If already has country code
  if (cleaned.startsWith(countryCode)) {
    return cleaned
  }

  return `${countryCode}${cleaned}`
}
