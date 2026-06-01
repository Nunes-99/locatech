/**
 * Seed básico — categorias padrão pra locadora de construção civil.
 *
 * Roda com: `npm run db:seed`
 *
 * O seed é **idempotente**: só cria categorias pra empresas que ainda não
 * têm nenhuma. Útil pra rodar depois do cadastro inicial de uma locadora.
 *
 * Empresas novas começam vazias por design (operador define seu próprio
 * vocabulário). Use este script só se quiser popular dados de demo.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const CONSTRUCTION_CATEGORIES = [
  { name: "Andaimes", icon: "🏗️", description: "Andaimes fachadeiros, tubulares, multidirecionais" },
  { name: "Betoneiras", icon: "🧱", description: "Misturadores de cimento, betoneiras de 120L a 600L" },
  { name: "Compactadores", icon: "⚙️", description: "Placas vibratórias, compactadores de solo, sapinhos" },
  { name: "Cortadoras", icon: "🪚", description: "Cortadoras de piso, serras de bancada, policortes" },
  { name: "Furadeiras / Martelos", icon: "🔨", description: "Marteletes, rompedores, perfuratrizes" },
  { name: "Geradores", icon: "⚡", description: "Geradores a diesel/gasolina, soldas, transformadores" },
  { name: "Vibradores", icon: "📳", description: "Vibradores de concreto, agulhas, motores" },
  { name: "Escoramentos", icon: "🪵", description: "Escoras metálicas, treliças, formas" },
  { name: "Pintura", icon: "🎨", description: "Compressores, pistolas de pintura, lixadeiras" },
  { name: "Limpeza", icon: "🧹", description: "Lavadoras de alta pressão, aspiradores industriais" },
  { name: "Acessórios", icon: "🛠️", description: "Carrinhos, baldes, padiolas, ferramentas manuais" },
] as const

async function main() {
  const companies = await prisma.company.findMany({
    where: {
      // Só empresas que ainda não têm nenhuma categoria
      categories: { none: {} },
    },
    select: { id: true, name: true },
  })

  if (companies.length === 0) {
    console.log("✓ Todas as empresas já têm categorias — nada pra fazer.")
    return
  }

  console.log(`Populando ${CONSTRUCTION_CATEGORIES.length} categorias em ${companies.length} empresa(s)...`)

  let total = 0
  for (const company of companies) {
    for (const cat of CONSTRUCTION_CATEGORIES) {
      await prisma.equipmentCategory.create({
        data: {
          companyId: company.id,
          name: cat.name,
          icon: cat.icon,
          description: cat.description,
        },
      })
      total++
    }
    console.log(`  → ${company.name}: ${CONSTRUCTION_CATEGORIES.length} categorias`)
  }

  console.log(`\n✓ ${total} categorias criadas.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
