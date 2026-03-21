/**
 * Blooming 商品レコメンド API
 * /api/blooming/products, /products/:id, /recommend, /filters, /recommendations
 */
import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import {
  loadBloomingProducts,
  searchCandidates,
  clearBloomingCache,
  type BloomingProductRecord,
  type BloomingSearchFilters,
} from './search'

const router = Router()

const RECOMMENDATIONS_PATH = path.join(process.cwd(), 'server', 'data', 'blooming_recommendations.json')

function loadRecommendations(): BloomingRecommendationStored[] {
  if (!fs.existsSync(RECOMMENDATIONS_PATH)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(RECOMMENDATIONS_PATH, 'utf-8'))
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function saveRecommendations(list: BloomingRecommendationStored[]) {
  const dir = path.dirname(RECOMMENDATIONS_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(RECOMMENDATIONS_PATH, JSON.stringify(list, null, 2), 'utf-8')
}

interface BloomingRecommendationStored {
  id: string
  query: string
  filters: BloomingSearchFilters
  results: Array<{
    productId: string
    product: BloomingProductRecord
    rank: number
    score: number
    reason: string
    matchedTags: string[]
  }>
  createdAt: string
}

/**
 * ランキング: モック実装（スコアは giftScore + キーワード一致）。
 * 実API接続時は server/prompts.ts の buildRecommendationPrompt でプロンプトを組み立て、
 * Gemini を呼び出して JSON をパースし、results を組み立てること。
 */
function mockRank(
  candidates: BloomingProductRecord[],
  query: string,
  topN: number = 10,
): Array<{ product: BloomingProductRecord; rank: number; score: number; reason: string; matchedTags: string[] }> {
  const terms = query.trim() ? query.trim().toLowerCase().split(/\s+/) : []
  const scored = candidates.map((p) => {
    let score = (p.giftScore ?? 5) / 10
    const matchedTags: string[] = []
    for (const t of terms) {
      if ((p.name || '').toLowerCase().includes(t)) { score += 0.2; matchedTags.push(p.name) }
      if ((p.aiSummary || '').toLowerCase().includes(t)) { score += 0.15; matchedTags.push(p.aiSummary!) }
      for (const tag of p.occasionTags || []) {
        if (tag.toLowerCase().includes(t)) { score += 0.1; matchedTags.push(tag) }
      }
    }
    return { product: p, score: Math.min(1, score), matchedTags }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topN).map((s, i) => ({
    product: s.product,
    rank: i + 1,
    score: s.score,
    reason: s.product.aiSummary || `${s.product.brand}の${s.product.category}です。`,
    matchedTags: [...new Set(s.matchedTags)].slice(0, 5),
  }))
}

// GET /api/blooming/products
router.get('/products', (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const perPage = Math.min(500, Math.max(1, Number(req.query.perPage) || 20))
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const keywords = typeof req.query.keywords === 'string' ? req.query.keywords.trim() : ''
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : ''
  const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : ''
  const budgetMin = req.query.budgetMin ? Number(req.query.budgetMin) : undefined
  const budgetMax = req.query.budgetMax ? Number(req.query.budgetMax) : undefined
  const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'giftScore'

  // フィルタ構築（構造化フィルタ + keywords でまず絞り込み）
  const filters: BloomingSearchFilters = {}
  if (category) filters.category = category
  if (brand) filters.brand = brand
  if (budgetMin != null && !isNaN(budgetMin)) filters.budgetMin = budgetMin
  if (budgetMax != null && !isNaN(budgetMax)) filters.budgetMax = budgetMax

  const hasFilters = keywords || q || category || brand || budgetMin != null || budgetMax != null

  let candidates: BloomingProductRecord[]
  if (hasFilters) {
    // Step 1: 構造化フィルタ + タグ由来キーワード(OR) で絞り込み
    candidates = searchCandidates(filters, keywords || undefined, 200)

    // Step 2: テキスト入力(q) で AND 絞り込み
    if (q) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
      candidates = candidates.filter((p) => {
        const name = (p.name || '').toLowerCase()
        const summary = (p.aiSummary || '').toLowerCase()
        const tags = [...(p.occasionTags || []), ...(p.useCaseTags || [])].map((t) => t.toLowerCase())
        const cat = (p.category || '').toLowerCase()
        const br = (p.brand || '').toLowerCase()
        // 全テキスト語がどこかにマッチ（AND）
        return terms.every(
          (t) => name.includes(t) || summary.includes(t) || tags.some((tag) => tag.includes(t)) || cat.includes(t) || br.includes(t),
        )
      })
    }
  } else {
    // フィルタもクエリもない → 全商品
    candidates = loadBloomingProducts().slice()
  }

  // ソート
  if (sort === 'price-asc') {
    candidates.sort((a, b) => a.price - b.price)
  } else if (sort === 'price-desc') {
    candidates.sort((a, b) => b.price - a.price)
  } else {
    // giftScore 降順（人気ランキング）
    candidates.sort((a, b) => (b.giftScore ?? 0) - (a.giftScore ?? 0))
  }

  const total = candidates.length
  const start = (page - 1) * perPage
  const items = candidates.slice(start, start + perPage)
  res.json({ items, total, page, perPage })
})

// GET /api/blooming/products/:id
router.get('/products/:id', (req: Request, res: Response) => {
  const products = loadBloomingProducts()
  const product = products.find((p) => p.id === req.params.id)
  if (!product) {
    res.status(404).json({ error: '商品が見つかりません' })
    return
  }
  res.json(product)
})

// POST /api/blooming/recommend
router.post('/recommend', (req: Request, res: Response) => {
  const body = req.body as { query?: string; filters?: BloomingSearchFilters }
  const query = typeof body.query === 'string' ? body.query : ''
  const filters: BloomingSearchFilters = body.filters || {}

  const candidates = searchCandidates(filters, query, 50)
  const ranked = mockRank(candidates, query, 10)

  const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const results = ranked.map((r) => ({
    productId: r.product.id,
    product: r.product,
    rank: r.rank,
    score: r.score,
    reason: r.reason,
    matchedTags: r.matchedTags,
  }))

  const rec: BloomingRecommendationStored = {
    id,
    query,
    filters,
    results,
    createdAt: new Date().toISOString(),
  }

  const list = loadRecommendations()
  list.unshift(rec)
  saveRecommendations(list.slice(0, 100))

  res.json(rec)
})

// GET /api/blooming/filters
router.get('/filters', (_req: Request, res: Response) => {
  const products = loadBloomingProducts()
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort()
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort()
  const occasions = [...new Set((products.flatMap((p) => p.occasionTags || [])))].filter(Boolean).sort()
  res.json({ categories, brands, occasions })
})

// GET /api/blooming/recommendations
router.get('/recommendations', (req: Request, res: Response) => {
  const list = loadRecommendations()
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20))
  res.json(list.slice(0, limit))
})

// POST /api/blooming/products — カタログに商品追加
router.post('/products', (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const brand = typeof body.brand === 'string' ? body.brand.trim() : ''
  const price = typeof body.price === 'number' ? body.price : NaN

  if (!name || !brand || isNaN(price)) {
    res.status(400).json({ error: 'name, brand, price は必須です' })
    return
  }

  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const newProduct: BloomingProductRecord = {
    id,
    source: 'rakuten',
    sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : '',
    name,
    brand,
    price,
    materials: Array.isArray(body.materials) ? body.materials : [],
    colors: Array.isArray(body.colors) ? body.colors : [],
    category: typeof body.category === 'string' ? body.category : '',
    gender: typeof body.gender === 'string' ? body.gender : '',
    collections: [],
    occasionTags: Array.isArray(body.occasionTags) ? body.occasionTags : [],
    useCaseTags: Array.isArray(body.useCaseTags) ? body.useCaseTags : [],
    priceSegment: price <= 770 ? 'budget' : price <= 1980 ? 'mid' : price <= 3300 ? 'premium' : 'luxury',
    giftScore: typeof body.giftScore === 'number' ? body.giftScore : 5,
    seasonality: [],
    aiSummary: typeof body.aiSummary === 'string' ? body.aiSummary : '',
    thumbnailUrl: typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl : '',
    imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
    scrapedAt: new Date().toISOString(),
  }

  // blooming_products.json に追記
  const productsPath = path.join(process.cwd(), 'server', 'data', 'blooming_products.json')
  let products: BloomingProductRecord[] = []
  try {
    products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'))
  } catch { /* empty */ }
  products.push(newProduct)
  fs.writeFileSync(productsPath, JSON.stringify(products, null, 2), 'utf-8')
  clearBloomingCache()

  res.status(201).json(newProduct)
})

export default router
