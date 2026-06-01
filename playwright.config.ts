import { defineConfig, devices } from "@playwright/test"

/**
 * Configuração mínima do Playwright pra smoke tests no LocaTech.
 *
 * Como rodar:
 *   1. App tem que estar rodando local (npm run dev) ou usar `webServer` config abaixo
 *   2. `npx playwright test` roda todos os testes
 *   3. `npx playwright test --headed` pra ver no browser
 *   4. `npx playwright codegen http://localhost:3000` pra gravar test novo
 *
 * Em CI, descomentar `webServer` pra subir o app automaticamente.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Adicionar Firefox/WebKit quando necessário; chromium cobre 90% dos casos
  ],

  // Quando rodar em CI ou em ambiente isolado, descomentar:
  // webServer: {
  //   command: "npm run start",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
})
