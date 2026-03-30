import { z } from "zod"

// Categorias
export const categorySchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional(),
  icon: z.string().optional(),
})

export type CategoryFormData = z.infer<typeof categorySchema>

// Equipamentos
export const equipmentSchema = z.object({
  categoryId: z.string().min(1, "Selecione uma categoria"),
  code: z.string().min(1, "Código é obrigatório"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  dailyRate: z.number().min(0.01, "Valor diário é obrigatório"),
  weeklyRate: z.number().optional().nullable(),
  monthlyRate: z.number().optional().nullable(),
  depositAmount: z.number().optional().nullable(),
  status: z.enum(["AVAILABLE", "RENTED", "MAINTENANCE", "RESERVED", "RETIRED"]).optional(),
  purchaseDate: z.date().optional().nullable(),
  purchaseValue: z.number().optional().nullable(),
})

export type EquipmentFormData = z.infer<typeof equipmentSchema>

// Clientes
export const customerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  document: z.string().min(11, "Documento inválido"),
  documentType: z.enum(["CPF", "CNPJ"]),
  phone: z.string().min(10, "Telefone inválido"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  creditScore: z.enum(["EXCELLENT", "GOOD", "REGULAR", "BAD", "BLOCKED"]).optional(),
  creditLimit: z.number().optional().nullable(),
  notes: z.string().optional(),
})

export type CustomerFormData = z.infer<typeof customerSchema>

// Locações
export const rentalSchema = z.object({
  customerId: z.string().min(1, "Selecione um cliente"),
  items: z.array(z.object({
    equipmentId: z.string(),
    quantity: z.number().min(1).default(1),
    days: z.number().min(1),
  })).min(1, "Adicione pelo menos um item"),
  startDate: z.date(),
  expectedEndDate: z.date(),
  type: z.enum(["DELIVERY", "PICKUP"]),
  deliveryAddress: z.string().optional(),
  deliveryFee: z.number().optional().default(0),
  discount: z.number().optional().default(0),
  depositAmount: z.number().optional().default(0),
  paymentMethod: z.enum(["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD", "BANK_SLIP", "TRANSFER"]).optional(),
  notes: z.string().optional(),
})

export type RentalFormData = z.infer<typeof rentalSchema>

// Manutenções
export const maintenanceSchema = z.object({
  equipmentId: z.string().min(1, "Selecione um equipamento"),
  type: z.enum(["PREVENTIVE", "CORRECTIVE", "INSPECTION"]),
  title: z.string().min(2, "Título deve ter pelo menos 2 caracteres"),
  description: z.string().optional(),
  laborCost: z.number().optional().default(0),
  partsCost: z.number().optional().default(0),
  scheduledDate: z.date().optional().nullable(),
  notes: z.string().optional(),
})

export type MaintenanceFormData = z.infer<typeof maintenanceSchema>
