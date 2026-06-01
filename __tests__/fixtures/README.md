# Fixtures de teste

Builders pra montar entidades válidas do Prisma sem precisar de banco.

## Uso típico

```ts
import { buildCompany, buildUser, buildRental } from "@/__tests__/fixtures/factories"

const company = buildCompany({ plan: "PRO" })
const owner = buildUser({ companyId: company.id, role: "OWNER" })
const rental = buildRental({ companyId: company.id, customerId: "x", total: "1500" })
```

## Convenções

- **Defaults aceitáveis**: cada factory produz um objeto que passaria validação básica
- **Overrides por spread**: `buildX({ ...campos })` substitui só os passados
- **IDs únicos**: a cada chamada o ID muda; use `resetFactoryCounter()` no `beforeEach` se quiser previsibilidade
- **Decimais como string**: campos `Decimal` do Prisma aceitam string — usamos isso pra não depender da lib `decimal.js` nos testes

## Cobertura

| Factory | Defaults | Override comum |
|---|---|---|
| `buildCompany` | FREE, sem CNPJ, sem slug | `plan`, `publicCatalog`, `slug` |
| `buildUser` | OPERATOR, termos aceitos | `role`, `companyId` |
| `buildCategory` | Categoria Teste | `name`, `companyId` |
| `buildEquipment` | AVAILABLE, R$ 100/dia | `status`, `dailyRate` |
| `buildCustomer` | CPF, REGULAR | `documentType`, `isBlocked` |
| `buildRental` | CONFIRMED, R$ 700 total | `status`, `paymentStatus` |
| `buildRentalItem` | 1 qtd × 7 dias | `quantity`, `days` |

## Quando NÃO usar

Pra testes de integração reais (B8.1) que precisam de FK válidas e cascade —
nesses, crie via `prisma.X.create()` mesmo, mas pode usar as factories como
base pra o `data: { ... }`.
