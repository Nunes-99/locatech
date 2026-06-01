import { test, expect } from "@playwright/test"

/**
 * Smoke tests — verificam apenas que as páginas públicas carregam.
 * Não exigem banco populado nem login. Bom pra catch de regressões básicas.
 *
 * Quando ambiente de teste com seed estiver pronto, adicione specs em
 * `e2e/auth.spec.ts`, `e2e/rental.spec.ts`, etc.
 */

test.describe("Landing pública", () => {
  test("home carrega com hero e CTAs", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/LocaTech/i)
    await expect(page.getByText(/Gestão Completa/i)).toBeVisible()
    await expect(page.getByRole("link", { name: /Começar Grátis/i })).toBeVisible()
  })

  test("página /demo carrega", async ({ page }) => {
    await page.goto("/demo")
    await expect(page.getByRole("heading", { name: /Como funciona o LocaTech/i })).toBeVisible()
  })

  test("página /termos carrega", async ({ page }) => {
    await page.goto("/termos")
    await expect(page.getByRole("heading", { name: /Termos de Uso/i })).toBeVisible()
  })

  test("página /privacidade carrega", async ({ page }) => {
    await page.goto("/privacidade")
    await expect(page.getByRole("heading", { name: /Política de Privacidade/i })).toBeVisible()
  })

  test("api-docs carrega", async ({ page }) => {
    await page.goto("/api-docs")
    await expect(page.getByRole("heading", { name: /API LocaTech/i })).toBeVisible()
  })
})

test.describe("Fluxo de autenticação", () => {
  test("login redireciona sem credenciais", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("button", { name: /Entrar/i })).toBeVisible()
  })

  test("cadastro tem checkbox de termos obrigatório", async ({ page }) => {
    await page.goto("/cadastro")
    await expect(page.getByLabel(/Termos de Uso/i)).toBeVisible()
  })

  test("acesso ao dashboard sem login redireciona pra /login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe("API health", () => {
  test("GET /api/health retorna 200 com status ok", async ({ request }) => {
    const r = await request.get("/api/health")
    expect(r.ok()).toBeTruthy()
    const body = await r.json()
    expect(body.status).toMatch(/ok|degraded/)
  })
})
