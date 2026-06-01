import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CatalogClient } from "./catalog-client"

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ search?: string; categoryId?: string }>
}

async function getCatalog(slug: string, search?: string, categoryId?: string) {
  const params = new URLSearchParams()
  if (search) params.set("search", search)
  if (categoryId) params.set("categoryId", categoryId)

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const response = await fetch(
    `${baseUrl}/api/public/catalog/${slug}?${params.toString()}`,
    { next: { revalidate: 60 } }
  )
  if (response.status === 404) return null
  if (!response.ok) throw new Error("catalog fetch failed")
  return response.json()
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const data = await getCatalog(slug).catch(() => null)
  if (!data) return { title: "Catálogo não encontrado" }
  return {
    title: `${data.company.name} — Catálogo`,
    description:
      data.company.headline || `Catálogo público de equipamentos para locação — ${data.company.name}.`,
  }
}

export default async function CatalogPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams
  const data = await getCatalog(slug, sp.search, sp.categoryId).catch(() => null)
  if (!data) notFound()

  return (
    <Suspense>
      <CatalogClient initialData={data} slug={slug} />
    </Suspense>
  )
}
