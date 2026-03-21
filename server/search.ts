/**
 * Blooming 商品検索エンジン（Stage 1: 構造化フィルタ）
 * 起動時に blooming_products.json をメモリにロードし、条件で絞り込み
 */
import fs from 'fs'
import path from 'path'

// サーバー用の型（src/types と一致）
export interface BloomingProductRecord {
  id: string
  source: string
  sourceUrl: string
  name: string
  brand: string
  price: number
  materials: string[]
  dimensions?: string
  colors: string[]
  category: string
  gender: string
  collections: string[]
  occasionTags: string[]
  useCaseTags: string[]
  priceSegment: string
  giftScore: number
  seasonality: string[]
  aiSummary: string
  thumbnailUrl: string
  imageUrls: string[]
  scrapedAt: string
  enrichedAt?: string
}

export interface BloomingSearchFilters {
  occasion?: string
  budgetMin?: number
  budgetMax?: number
  gender?: string
  category?: string
  brand?: string
  materials?: string[]
}

let productsCache: BloomingProductRecord[] | null = null

function getProductsPath(): string {
  return path.join(process.cwd(), 'server', 'data', 'blooming_products.json')
}

export function loadBloomingProducts(): BloomingProductRecord[] {
  if (productsCache) return productsCache
  const filePath = getProductsPath()
  if (!fs.existsSync(filePath)) {
    productsCache = []
    return []
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  productsCache = Array.isArray(raw) ? raw : []
  return productsCache
}

export function clearBloomingCache(): void {
  productsCache = null
}

const DEFAULT_CANDIDATE_LIMIT = 50

/**
 * Stage 1: フィルタ条件とクエリで候補を絞り込み（最大50件）
 */
export function searchCandidates(
  filters: BloomingSearchFilters,
  query?: string,
  limit: number = DEFAULT_CANDIDATE_LIMIT,
): BloomingProductRecord[] {
  const products = loadBloomingProducts()
  let result = products

  if (filters.budgetMin != null) {
    result = result.filter((p) => p.price >= filters.budgetMin!)
  }
  if (filters.budgetMax != null) {
    result = result.filter((p) => p.price <= filters.budgetMax!)
  }
  if (filters.gender) {
    result = result.filter((p) => !p.gender || p.gender === filters.gender)
  }
  if (filters.category) {
    result = result.filter((p) => p.category === filters.category)
  }
  if (filters.brand) {
    result = result.filter((p) => p.brand.includes(filters.brand!))
  }
  if (filters.materials?.length) {
    const set = new Set(filters.materials)
    result = result.filter((p) => p.materials.some((m) => set.has(m)))
  }
  if (filters.occasion) {
    const kw = filters.occasion.toLowerCase()
    result = result.filter(
      (p) =>
        (p.occasionTags && p.occasionTags.some((t) => t.toLowerCase().includes(kw))) ||
        (p.useCaseTags && p.useCaseTags.some((t) => t.toLowerCase().includes(kw))) ||
        (p.aiSummary && p.aiSummary.toLowerCase().includes(kw)),
    )
  }

  if (query && query.trim()) {
    const q = query.trim().toLowerCase()
    const terms = q.split(/\s+/).filter(Boolean)
    result = result.filter((p) => {
      const name = (p.name || '').toLowerCase()
      const summary = (p.aiSummary || '').toLowerCase()
      const tags = [...(p.occasionTags || []), ...(p.useCaseTags || [])].map((t) => t.toLowerCase())
      return terms.some(
        (t) => name.includes(t) || summary.includes(t) || tags.some((tag) => tag.includes(t)) || (p.category || '').toLowerCase().includes(t),
      )
    })
  }

  return result.slice(0, limit)
}
