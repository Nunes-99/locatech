"use client"

import { useState } from "react"
import Link from "next/link"
import { Wrench, ArrowLeft, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }

      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar e-mail")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <>
        <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
          <Wrench className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold text-primary">LocaTech</span>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">E-mail enviado!</h2>
              <p className="text-muted-foreground">
                Se o e-mail <strong>{email}</strong> estiver cadastrado, você
                receberá um link para redefinir sua senha.
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full mt-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para o login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
        <Wrench className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold text-primary">LocaTech</span>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Esqueceu a senha?</CardTitle>
          <CardDescription>
            Digite seu e-mail para receber um link de recuperação
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

            <Button type="submit" className="w-full" loading={loading}>
              Enviar link de recuperação
            </Button>

            <Link href="/login" className="block">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para o login
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
