"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import { Search, Phone, Mail, MapPin, MessageCircle, Package } from "lucide-react"

interface Company {
  name: string
  logoUrl: string | null
  primaryColor: string | null
  headline: string | null
  whatsapp: string | null
  phone: string | null
  email: string | null
  location: string
}

interface Category {
  id: string
  name: string
  icon: string | null
}

interface Equipment {
  id: string
  code: string
  name: string
  brand: string | null
  model: string | null
  description: string | null
  imageUrl: string | null
  dailyRate: number
  weeklyRate: number | null
  monthlyRate: number | null
  status: string
  category: { id: string; name: string }
}

interface CatalogData {
  company: Company
  categories: Category[]
  equipment: Equipment[]
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function CatalogClient({
  initialData,
  slug,
}: {
  initialData: CatalogData
  slug: string
}) {
  const [data, setData] = useState<CatalogData>(initialData)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const primary = data.company.primaryColor || "#2563EB"

  const refetch = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (activeCategory) params.set("categoryId", activeCategory)
    const r = await fetch(`/api/public/catalog/${slug}?${params}`)
    if (r.ok) setData(await r.json())
  }, [search, activeCategory, slug])

  useEffect(() => {
    const handle = setTimeout(refetch, 300)
    return () => clearTimeout(handle)
  }, [refetch])

  function whatsappLink(equipment?: Equipment) {
    if (!data.company.whatsapp) return null
    const phone = data.company.whatsapp.replace(/\D/g, "")
    const text = equipment
      ? `Olá! Tenho interesse em alugar o equipamento ${equipment.name} (${equipment.code}). Está disponível?`
      : `Olá! Tenho interesse no catálogo de ${data.company.name}.`
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
  }

  const heroLink = whatsappLink()

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header style={{ backgroundColor: primary }} className="text-white shadow-md">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-6">
          <div className="flex items-center gap-3">
            {data.company.logoUrl ? (
              <Image
                src={data.company.logoUrl}
                alt={data.company.name}
                width={56}
                height={56}
                className="h-14 w-14 rounded-lg bg-white object-contain p-1"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/20">
                <Package className="h-7 w-7" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{data.company.name}</h1>
              {data.company.headline && (
                <p className="text-sm text-white/90">{data.company.headline}</p>
              )}
            </div>
          </div>
          {heroLink && (
            <a
              href={heroLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-lg bg-green-500 px-4 py-2 font-semibold text-white shadow hover:bg-green-600 md:inline-flex"
            >
              <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
            </a>
          )}
        </div>
      </header>

      {/* Filtros */}
      <section className="border-b bg-white">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar equipamento, marca, código…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-wrap gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveCategory(null)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                activeCategory === null
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Todos
            </button>
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                  activeCategory === cat.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cat.icon ? `${cat.icon} ` : ""}
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid de equipamentos */}
      <section className="container mx-auto px-4 py-8">
        {data.equipment.length === 0 ? (
          <div className="rounded-lg border bg-white p-12 text-center text-slate-500">
            Nenhum equipamento disponível com os filtros aplicados.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.equipment.map((eq) => (
              <article
                key={eq.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-video bg-slate-100">
                  {eq.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={eq.imageUrl}
                      alt={eq.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <Package className="h-12 w-12" />
                    </div>
                  )}
                  <span
                    className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700"
                    title={eq.code}
                  >
                    {eq.category.name}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900">{eq.name}</h3>
                  {(eq.brand || eq.model) && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[eq.brand, eq.model].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {eq.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{eq.description}</p>
                  )}
                  <div className="mt-3 space-y-0.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Diária:</span>
                      <span className="font-semibold">{BRL.format(eq.dailyRate)}</span>
                    </div>
                    {eq.weeklyRate && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Semanal:</span>
                        <span>{BRL.format(eq.weeklyRate)}</span>
                      </div>
                    )}
                    {eq.monthlyRate && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Mensal:</span>
                        <span>{BRL.format(eq.monthlyRate)}</span>
                      </div>
                    )}
                  </div>
                  {whatsappLink(eq) && (
                    <a
                      href={whatsappLink(eq)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white hover:bg-green-600"
                    >
                      <MessageCircle className="h-4 w-4" /> Reservar
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-8 border-t bg-white">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-6 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <div className="font-medium">{data.company.name}</div>
          <div className="flex flex-wrap gap-4">
            {data.company.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {data.company.phone}
              </span>
            )}
            {data.company.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {data.company.email}
              </span>
            )}
            {data.company.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {data.company.location}
              </span>
            )}
          </div>
        </div>
      </footer>
    </main>
  )
}
