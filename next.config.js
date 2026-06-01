/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production"

const ContentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' segue necessário pros scripts inline que o Next 14 emite
  // durante a hidratação. Próximo passo: migrar pra nonce-based CSP (precisa
  // de setup adicional no middleware). 'unsafe-eval' foi removido — se alguma
  // lib quebrar em runtime (Recharts em versões antigas, etc), reverter.
  "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.mercadopago.com https://viacep.com.br",
  "frame-src https://www.mercadopago.com.br https://www.mercadopago.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isProd ? "upgrade-insecure-requests" : "",
]
  .filter(Boolean)
  .join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Isolamento de origem — defesa contra Spectre + vazamento via cross-origin
  // window.opener. `same-origin` é o mais estrito que ainda permite OAuth popup
  // se precisarmos depois (`same-origin-allow-popups` em endpoints específicos).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
]

const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
