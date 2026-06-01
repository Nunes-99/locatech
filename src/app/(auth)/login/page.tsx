"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Wrench, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [needsTotp, setNeedsTotp] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        totpCode: needsTotp ? totpCode : undefined,
        redirect: false,
      })

      if (result?.error) {
        // Server sinaliza "TOTP_REQUIRED" quando 2FA tá ativa mas código não veio
        if (result.error === "TOTP_REQUIRED") {
          setNeedsTotp(true)
          setError("")
        } else {
          setError(result.error)
        }
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError("Erro ao fazer login. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Mobile logo */}
      <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
        <Wrench className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold text-primary">LocaTech</span>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Entrar</CardTitle>
          <CardDescription>
            Digite suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" required>E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" required>Senha</Label>
                <Link
                  href="/esqueci-senha"
                  className="text-sm text-primary hover:underline"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {needsTotp && (
              <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/30">
                <Label htmlFor="totp" className="flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" /> Código 2FA
                </Label>
                <Input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  placeholder="6 dígitos do app autenticador"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  autoFocus
                  autoComplete="one-time-code"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Ou use um código de backup (8 caracteres).
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              {needsTotp ? "Confirmar código" : "Entrar"}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Não tem uma conta?{" "}
              <Link href="/cadastro" className="text-primary hover:underline font-medium">
                Cadastre-se
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
