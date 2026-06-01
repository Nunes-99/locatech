/**
 * Dicionário pt-BR. Fonte da verdade — adicione chaves aqui e depois traduza.
 *
 * Convenção: dot notation `area.contexto.string`.
 * Variáveis: `{name}` no template, passe `{ name: "..." }` pro t().
 */
export const ptBR: Record<string, string> = {
  // common
  "common.save": "Salvar",
  "common.cancel": "Cancelar",
  "common.delete": "Excluir",
  "common.edit": "Editar",
  "common.confirm": "Confirmar",
  "common.back": "Voltar",
  "common.search": "Buscar",
  "common.loading": "Carregando…",
  "common.empty": "Nenhum resultado.",
  "common.actions": "Ações",
  "common.yes": "Sim",
  "common.no": "Não",
  "common.required": "Obrigatório",
  "common.optional": "Opcional",

  // auth
  "auth.login": "Entrar",
  "auth.logout": "Sair",
  "auth.register": "Criar conta",
  "auth.email": "E-mail",
  "auth.password": "Senha",
  "auth.forgotPassword": "Esqueci minha senha",
  "auth.invalidCredentials": "Credenciais inválidas",
  "auth.unauthorized": "Você precisa estar logado",
  "auth.forbidden": "Sem permissão",

  // rental
  "rental.title": "Locação",
  "rental.contractNumber": "Contrato #{number}",
  "rental.status.QUOTE": "Orçamento",
  "rental.status.CONFIRMED": "Confirmada",
  "rental.status.IN_PROGRESS": "Em andamento",
  "rental.status.OVERDUE": "Atrasada",
  "rental.status.RETURNED": "Devolvida",
  "rental.status.COMPLETED": "Concluída",
  "rental.status.CANCELLED": "Cancelada",
  "rental.daysRemaining": "Faltam {count} dia(s) pra devolver",

  // equipment
  "equipment.status.AVAILABLE": "Disponível",
  "equipment.status.RENTED": "Locado",
  "equipment.status.MAINTENANCE": "Em manutenção",
  "equipment.status.RESERVED": "Reservado",
  "equipment.status.RETIRED": "Baixado",

  // customer
  "customer.creditScore.EXCELLENT": "Excelente",
  "customer.creditScore.GOOD": "Bom",
  "customer.creditScore.REGULAR": "Regular",
  "customer.creditScore.BAD": "Ruim",
  "customer.creditScore.BLOCKED": "Bloqueado",
}
