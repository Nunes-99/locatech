import { Resend } from "resend"

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail(options: EmailOptions) {
  try {
    if (!resend) {
      console.warn("Resend API key not configured, skipping email send")
      return { success: false, error: "Email service not configured" }
    }

    const { to, subject, html, from = "LocaTech <noreply@locatech.com.br>" } = options

    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
    })

    return { success: true, data: result }
  } catch (error) {
    console.error("Error sending email:", error)
    return { success: false, error }
  }
}

// Templates de Email
export function getRentalConfirmationEmail(data: {
  customerName: string
  contractNumber: number
  startDate: string
  endDate: string
  total: string
  companyName: string
}) {
  return {
    subject: `Confirmação de Locação #${data.contractNumber} - ${data.companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .highlight { background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.companyName}</h1>
          </div>
          <div class="content">
            <h2>Olá, ${data.customerName}!</h2>
            <p>Sua locação foi confirmada com sucesso.</p>

            <div class="highlight">
              <strong>Contrato:</strong> #${data.contractNumber}<br>
              <strong>Período:</strong> ${data.startDate} a ${data.endDate}<br>
              <strong>Valor Total:</strong> ${data.total}
            </div>

            <p>Em breve você receberá mais informações sobre a entrega/retirada dos equipamentos.</p>

            <p>Qualquer dúvida, entre em contato conosco.</p>
          </div>
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
            <p>${data.companyName}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }
}

export function getRentalReminderEmail(data: {
  customerName: string
  contractNumber: number
  endDate: string
  daysRemaining: number
  companyName: string
}) {
  return {
    subject: `Lembrete: Devolução em ${data.daysRemaining} dia(s) - Contrato #${data.contractNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .warning { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Lembrete de Devolução</h1>
          </div>
          <div class="content">
            <h2>Olá, ${data.customerName}!</h2>

            <div class="warning">
              <strong>Atenção:</strong> Sua locação (Contrato #${data.contractNumber})
              vence em <strong>${data.daysRemaining} dia(s)</strong> (${data.endDate}).
            </div>

            <p>Por favor, providencie a devolução dos equipamentos até a data prevista para evitar multas por atraso.</p>

            <p>Caso precise estender o período de locação, entre em contato conosco.</p>
          </div>
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
            <p>${data.companyName}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }
}

export function getOverdueNotificationEmail(data: {
  customerName: string
  contractNumber: number
  daysOverdue: number
  equipmentList: string
  lateFee: number
  companyName: string
  companyPhone: string
}) {
  const lateFeeFormatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(data.lateFee)

  return {
    subject: `URGENTE: Locação em atraso - Contrato #${data.contractNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .alert { background: #fee2e2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Locação em Atraso</h1>
          </div>
          <div class="content">
            <h2>Olá, ${data.customerName}!</h2>

            <div class="alert">
              <strong>Atenção:</strong> Sua locação (Contrato #${data.contractNumber})
              está em atraso há <strong>${data.daysOverdue} dia(s)</strong>.<br><br>
              <strong>Equipamentos:</strong> ${data.equipmentList}<br>
              <strong>Multa acumulada:</strong> ${lateFeeFormatted}
            </div>

            <p>Por favor, entre em contato conosco imediatamente para regularizar a situação.</p>

            <p>A multa por atraso é calculada diariamente e será acrescida ao valor final da locação.</p>
          </div>
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
            <p>${data.companyName}${data.companyPhone ? ` - ${data.companyPhone}` : ""}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }
}

export function getMaintenanceAlertEmail(data: {
  userName: string
  equipmentCode: string
  equipmentName: string
  maintenanceType: string
  scheduledDate: string
  companyName: string
}) {
  return {
    subject: `Alerta: Manutenção ${data.maintenanceType} - ${data.equipmentCode}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .info { background: #ede9fe; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Alerta de Manutenção</h1>
          </div>
          <div class="content">
            <h2>Olá, ${data.userName}!</h2>

            <p>Um equipamento está com manutenção ${data.maintenanceType.toLowerCase()} agendada.</p>

            <div class="info">
              <strong>Equipamento:</strong> ${data.equipmentCode} - ${data.equipmentName}<br>
              <strong>Tipo:</strong> Manutenção ${data.maintenanceType}<br>
              <strong>Data Agendada:</strong> ${data.scheduledDate}
            </div>

            <p>Acesse o sistema para mais detalhes e acompanhar a manutenção.</p>
          </div>
          <div class="footer">
            <p>Este é um email automático.</p>
            <p>${data.companyName}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }
}
