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

// Wrapper estilo template-name → permite enviar em uma chamada só
type TemplateBuilder<T> = (data: T) => { subject: string; html: string }

export async function sendTemplated<T>(
  to: string,
  builder: TemplateBuilder<T>,
  data: T
) {
  const { subject, html } = builder(data)
  return sendEmail({ to, subject, html })
}

/**
 * Branding opcional injetado nos templates de email.
 * Cada chamador pode passar `branding` pra customizar com a identidade da locadora.
 */
export interface EmailBranding {
  /** Hex do header. Default azul institucional. */
  headerColor?: string
  /** URL absoluta da logo (PNG/JPG). Se ausente, mostra apenas o título. */
  logoUrl?: string
}

function shell(
  defaultHeaderColor: string,
  title: string,
  inner: string,
  footer: string,
  branding?: EmailBranding
) {
  const headerColor = branding?.headerColor || defaultHeaderColor
  const logo = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="" style="max-height: 56px; max-width: 200px; margin-bottom: 8px; display: inline-block;" />`
    : ""
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${headerColor}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .box { padding: 15px; border-radius: 8px; margin: 15px 0; }
        .button { display: inline-block; background: ${headerColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">${logo}<h1 style="margin: 0;">${title}</h1></div>
        <div class="content">${inner}</div>
        <div class="footer">${footer}</div>
      </div>
    </body>
    </html>
  `
}

export function getPasswordResetEmail(data: {
  userName: string
  resetLink: string
  companyName?: string
}) {
  const company = data.companyName ?? "LocaTech"
  return {
    subject: `Redefinição de senha - ${company}`,
    html: shell(
      "#2563eb",
      company,
      `
        <h2>Olá, ${data.userName}!</h2>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
        <p style="text-align: center;">
          <a href="${data.resetLink}" class="button">Redefinir Senha</a>
        </p>
        <p><strong>Este link expira em 1 hora.</strong></p>
        <p>Se você não solicitou, ignore este e-mail.</p>
      `,
      `<p>Este é um e-mail automático. Por favor, não responda.</p><p>${company}</p>`
    ),
  }
}

export function getEmailVerifyEmail(data: {
  userName: string
  verifyLink: string
  companyName?: string
}) {
  const company = data.companyName ?? "LocaTech"
  return {
    subject: `Confirme seu email — ${company}`,
    html: shell(
      "#10b981",
      "Confirme seu email",
      `
        <h2>Olá, ${data.userName}!</h2>
        <p>Pra ativar sua conta, confirme seu endereço de email clicando no botão abaixo:</p>
        <p style="text-align: center;">
          <a href="${data.verifyLink}" class="button">Confirmar meu email</a>
        </p>
        <p><strong>Este link expira em 24 horas.</strong></p>
        <p>Se você não criou conta no LocaTech, ignore este email.</p>
      `,
      `<p>${company}</p>`
    ),
  }
}

export function getWelcomeEmail(data: {
  userName: string
  companyName: string
  loginUrl: string
}) {
  return {
    subject: `Bem-vindo(a) ao ${data.companyName}!`,
    html: shell(
      "#10b981",
      "Bem-vindo!",
      `
        <h2>Olá, ${data.userName}!</h2>
        <p>Seu cadastro foi concluído com sucesso. Agora você pode acessar o sistema e começar a gerenciar a sua locadora.</p>
        <p style="text-align:center;">
          <a href="${data.loginUrl}" class="button">Acessar o Sistema</a>
        </p>
        <p>Bom trabalho!</p>
      `,
      `<p>${data.companyName}</p>`
    ),
  }
}

export function getRentalReturnedEmail(data: {
  customerName: string
  contractNumber: number
  returnDate: string
  total: string
  hasDamage: boolean
  damageValue?: string
  companyName: string
}) {
  return {
    subject: `Devolução concluída - Contrato #${data.contractNumber}`,
    html: shell(
      "#10b981",
      "Devolução Confirmada",
      `
        <h2>Olá, ${data.customerName}!</h2>
        <p>A devolução do contrato <strong>#${data.contractNumber}</strong> foi registrada em ${data.returnDate}.</p>
        <div class="box" style="background: #d1fae5;">
          <strong>Valor total:</strong> ${data.total}
          ${data.hasDamage ? `<br><strong>Valor por danos:</strong> ${data.damageValue ?? "-"}` : ""}
        </div>
        <p>Agradecemos a preferência!</p>
      `,
      `<p>${data.companyName}</p>`
    ),
  }
}

export function getInvoiceIssuedEmail(data: {
  customerName: string
  contractNumber: number
  invoiceNumber: string
  amount: string
  pdfUrl?: string
  xmlUrl?: string
  companyName: string
}) {
  return {
    subject: `Nota fiscal #${data.invoiceNumber} — ${data.companyName}`,
    html: shell(
      "#0ea5e9",
      "Nota Fiscal Emitida",
      `
        <h2>Olá, ${data.customerName}!</h2>
        <p>A nota fiscal referente ao contrato <strong>#${data.contractNumber}</strong> foi emitida.</p>
        <div class="box" style="background: #e0f2fe;">
          <strong>Número:</strong> ${data.invoiceNumber}<br>
          <strong>Valor:</strong> ${data.amount}
        </div>
        ${data.pdfUrl ? `<p style="text-align:center;"><a href="${data.pdfUrl}" class="button">Baixar PDF da nota</a></p>` : ""}
        ${data.xmlUrl ? `<p style="text-align:center;"><a href="${data.xmlUrl}" style="color:#0ea5e9; text-decoration:underline;">Baixar XML</a></p>` : ""}
        <p>Guarde a nota para sua contabilidade.</p>
      `,
      `<p>${data.companyName}</p>`
    ),
  }
}

export function getDepositReturnedEmail(data: {
  customerName: string
  contractNumber: number
  depositAmount: string
  companyName: string
}) {
  return {
    subject: `Caução devolvida - Contrato #${data.contractNumber}`,
    html: shell(
      "#0ea5e9",
      "Caução Devolvida",
      `
        <h2>Olá, ${data.customerName}!</h2>
        <p>A caução do contrato <strong>#${data.contractNumber}</strong> foi devolvida.</p>
        <div class="box" style="background: #dbeafe;">
          <strong>Valor:</strong> ${data.depositAmount}
        </div>
        <p>Caso tenha dúvidas, entre em contato.</p>
      `,
      `<p>${data.companyName}</p>`
    ),
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
