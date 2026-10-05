"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Package,
  Users,
  UserCog,
  ClipboardList,
  Wrench,
  Calendar,
  BarChart3,
  Settings,
  Building2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { canPerform, type Permission, type Role } from "@/lib/permissions"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

// Cada item só aparece para quem tem a permissão (antes o operador via Lucro,
// Usuários e Auditoria no menu — e abria as telas)
const menuItems: { href: string; label: string; icon: typeof LayoutDashboard; perm?: Permission }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/equipamentos", label: "Equipamentos", icon: Package, perm: "equipment.view" },
  { href: "/clientes", label: "Clientes", icon: Users, perm: "customer.view" },
  { href: "/locacoes", label: "Locações", icon: ClipboardList, perm: "rental.view" },
  { href: "/calendario", label: "Calendário", icon: Calendar, perm: "rental.view" },
  { href: "/manutencoes", label: "Manutenções", icon: Wrench, perm: "maintenance.view" },
  { href: "/lucro", label: "Lucro", icon: TrendingUp, perm: "financial.view" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, perm: "report.view" },
  { href: "/usuarios", label: "Usuários", icon: UserCog, perm: "user.view" },
  { href: "/lojas", label: "Lojas", icon: Building2, perm: "company.update" },
  { href: "/seguranca", label: "Segurança", icon: ShieldCheck },
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck, perm: "audit.view" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, perm: "company.update" },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth()
  const itensVisiveis = menuItems.filter(
    (item) => !item.perm || (user ? canPerform(user.role as Role, item.perm) : false)
  )
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-white transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">LocaTech</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <Building2 className="h-8 w-8 text-primary" />
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {itensVisiveis.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href))

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-white text-slate-900 shadow-md hover:bg-slate-100"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  )
}
