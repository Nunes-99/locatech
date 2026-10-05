"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { Search, Menu } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationDropdown } from "@/components/notifications/notification-dropdown"
import { useAuth } from "@/hooks/use-auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface HeaderProps {
  onMenuClick?: () => void
}

const PAPEIS: Record<string, string> = { OWNER: "Proprietário", ADMIN: "Administrador", OPERATOR: "Operador" }

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [busca, setBusca] = useState("")

  // A busca do topo leva à lista de equipamentos já filtrada (antes não fazia nada)
  function buscar(e: React.FormEvent) {
    e.preventDefault()
    const termo = busca.trim()
    if (!termo) return
    router.push(`/equipamentos?busca=${encodeURIComponent(termo)}`)
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <form onSubmit={buscar} role="search" className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar equipamento (nome, código, marca)..."
          aria-label="Buscar equipamento"
          className="pl-10 bg-slate-50 border-slate-200"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </form>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationDropdown />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-slate-100">
              <Avatar alt={user?.name ?? "Usuário"} size="sm" />
              <div className="hidden text-left lg:block">
                <p className="text-sm font-medium">{user?.name ?? "…"}</p>
                <p className="text-xs text-muted-foreground">{user?.companyName ?? ""}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block">{user?.name ?? "Minha conta"}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {user?.email}
                {user?.role ? ` · ${PAPEIS[user.role] ?? user.role}` : ""}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/seguranca">Segurança da conta</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/configuracoes">Configurações</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onSelect={() => signOut({ callbackUrl: "/login" })}
            >
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
