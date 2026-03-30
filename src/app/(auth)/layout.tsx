import { Wrench } from "lucide-react"
import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-white">
        <Link href="/" className="flex items-center gap-2">
          <Wrench className="h-8 w-8" />
          <span className="text-2xl font-bold">LocaTech</span>
        </Link>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Gerencie suas locações de equipamentos com eficiência
          </h1>
          <p className="text-lg text-blue-100">
            Sistema completo para locadoras: controle de equipamentos, clientes,
            locações, manutenções e financeiro em um só lugar.
          </p>
          <ul className="space-y-3 text-blue-100">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full" />
              Controle total do seu estoque
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full" />
              Calendário de locações integrado
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full" />
              Relatórios e métricas em tempo real
            </li>
          </ul>
        </div>

        <p className="text-sm text-blue-200">
          &copy; {new Date().getFullYear()} LocaTech. Todos os direitos reservados.
        </p>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
