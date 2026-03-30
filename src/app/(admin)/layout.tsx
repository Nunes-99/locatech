import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/login")
  }

  // Check if user is a system admin (special role or email domain)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, role: true },
  })

  // Only allow specific admin emails or roles
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim())
  const isAdmin = user?.email && (adminEmails.includes(user.email) || user.role === "OWNER")

  if (!isAdmin) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-900 text-white p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl">LocaTech</span>
            <span className="bg-red-600 text-xs px-2 py-1 rounded">ADMIN</span>
          </div>
          <nav className="flex gap-4">
            <a href="/admin" className="hover:text-gray-300">Dashboard</a>
            <a href="/admin/companies" className="hover:text-gray-300">Empresas</a>
            <a href="/admin/users" className="hover:text-gray-300">Usuários</a>
            <a href="/dashboard" className="hover:text-gray-300">Voltar ao App</a>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
