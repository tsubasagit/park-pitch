import type {
  Company,
  Proposal,
  ProposalSummary,
  ProposalRequest,
  ParsedRequest,
  BloomingProduct,
  BloomingSearchFilters,
  BloomingRecommendation,
  ProposalJSON,
} from '../types'
import { db } from '../lib/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore'

// ─── Company (Firestore direct) ──────────────────────

export async function getCompany(): Promise<Company | null> {
  const snap = await getDoc(doc(db, 'config', 'company'))
  return snap.exists() ? (snap.data() as Company) : null
}

export async function saveCompany(data: Omit<Company, 'updatedAt'>): Promise<Company> {
  const company = { ...data, updatedAt: new Date().toISOString() }
  await setDoc(doc(db, 'config', 'company'), company)
  return company as Company
}

// ─── Proposals (Firestore direct) ────────────────────

export async function getProposals(): Promise<ProposalSummary[]> {
  const snap = await getDocs(query(collection(db, 'proposals'), orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      clientName: data.clientName || '御社',
      productNames: data.productNames || data.serviceNames || [],
      createdAt: data.createdAt,
    } as ProposalSummary
  })
}

export async function getProposal(id: string): Promise<Proposal> {
  const snap = await getDoc(doc(db, 'proposals', id))
  if (!snap.exists()) throw new Error('提案書が見つかりません')
  return { id: snap.id, ...snap.data() } as Proposal
}

export async function updateProposal(id: string, jsonContent: ProposalJSON): Promise<Proposal> {
  const ref = doc(db, 'proposals', id)
  await updateDoc(ref, { jsonContent })
  const snap = await getDoc(ref)
  return { id: snap.id, ...snap.data() } as Proposal
}

// ─── Parse Request & Generate (server API — fallback to error) ───

export async function parseRequest(_text: string): Promise<{
  parsed: ParsedRequest
  recommendedProducts: (BloomingProduct & { rank: number; score: number; matchedTags: string[] })[]
}> {
  // AI解析はサーバーAPI経由（Cloud Functions利用不可の場合はエラー）
  throw new Error('AI解析機能は現在サーバーセットアップ中です。テキスト検索をご利用ください。')
}

export async function generateProposal(_input: ProposalRequest): Promise<Proposal> {
  throw new Error('提案書生成機能は現在サーバーセットアップ中です。')
}

// ─── Blooming Products (Firestore direct) ────────────

let cachedProducts: BloomingProduct[] | null = null

async function loadAllProducts(): Promise<BloomingProduct[]> {
  if (cachedProducts) return cachedProducts
  const snap = await getDocs(collection(db, 'blooming_products'))
  cachedProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BloomingProduct))
  return cachedProducts
}

export async function getBloomingProducts(params?: {
  page?: number
  perPage?: number
  q?: string
  keywords?: string
  category?: string
  brand?: string
  budgetMin?: number
  budgetMax?: number
  sort?: string
}): Promise<{
  items: BloomingProduct[]
  total: number
  page: number
  perPage: number
}> {
  const page = params?.page ?? 1
  const perPage = params?.perPage ?? 20

  let products = await loadAllProducts()

  // フィルタ
  if (params?.category) products = products.filter((p) => p.category === params.category)
  if (params?.brand) products = products.filter((p) => p.brand === params.brand)
  if (params?.budgetMin != null) products = products.filter((p) => p.price >= params.budgetMin!)
  if (params?.budgetMax != null) products = products.filter((p) => p.price <= params.budgetMax!)

  // テキスト検索
  const q = params?.q?.trim()
  if (q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    products = products.filter((p) => {
      const name = (p.name || '').toLowerCase()
      const summary = (p.aiSummary || '').toLowerCase()
      const cat = (p.category || '').toLowerCase()
      const br = (p.brand || '').toLowerCase()
      const tags = [...(p.occasionTags || []), ...(p.useCaseTags || [])].map((t) => t.toLowerCase())
      return terms.every(
        (t) => name.includes(t) || summary.includes(t) || cat.includes(t) || br.includes(t) || tags.some((tag) => tag.includes(t)),
      )
    })
  }

  // ソート
  const sort = params?.sort || 'giftScore'
  if (sort === 'price-asc') {
    products.sort((a, b) => a.price - b.price)
  } else if (sort === 'price-desc') {
    products.sort((a, b) => b.price - a.price)
  } else {
    products.sort((a, b) => (b.giftScore ?? 0) - (a.giftScore ?? 0))
  }

  const total = products.length
  const start = (page - 1) * perPage
  const items = products.slice(start, start + perPage)
  return { items, total, page, perPage }
}

export async function addBloomingProduct(data: {
  name: string
  brand: string
  price: number
  category?: string
  materials?: string[]
  colors?: string[]
  occasionTags?: string[]
  useCaseTags?: string[]
  aiSummary?: string
  giftScore?: number
  thumbnailUrl?: string
}): Promise<BloomingProduct> {
  const product = {
    source: 'custom',
    sourceUrl: '',
    name: data.name,
    brand: data.brand,
    price: data.price,
    materials: data.materials || [],
    colors: data.colors || [],
    category: data.category || '',
    gender: '',
    collections: [],
    occasionTags: data.occasionTags || [],
    useCaseTags: data.useCaseTags || [],
    priceSegment: data.price <= 770 ? 'budget' : data.price <= 1980 ? 'mid' : data.price <= 3300 ? 'premium' : 'luxury',
    giftScore: data.giftScore ?? 5,
    seasonality: [],
    aiSummary: data.aiSummary || '',
    thumbnailUrl: data.thumbnailUrl || '',
    imageUrls: [],
    scrapedAt: new Date().toISOString(),
  }
  const ref = await addDoc(collection(db, 'blooming_products'), product)
  cachedProducts = null // キャッシュ無効化
  return { id: ref.id, ...product } as BloomingProduct
}

export async function getBloomingProduct(id: string): Promise<BloomingProduct> {
  const snap = await getDoc(doc(db, 'blooming_products', id))
  if (!snap.exists()) throw new Error('商品が見つかりません')
  return { id: snap.id, ...snap.data() } as BloomingProduct
}

export async function getBloomingFilters(): Promise<{
  categories: string[]
  brands: string[]
  occasions: string[]
}> {
  const products = await loadAllProducts()
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort()
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort()
  const occasions = [...new Set(products.flatMap((p) => p.occasionTags || []).filter(Boolean))].sort()
  return { categories, brands, occasions }
}

export async function getBloomingRecommendations(_limit?: number): Promise<BloomingRecommendation[]> {
  return []
}

export async function searchBloomingRecommend(body: {
  query?: string
  filters?: BloomingSearchFilters
}): Promise<BloomingRecommendation> {
  const q = body.query || ''
  const products = await loadAllProducts()

  // スコアリング
  const terms = q.trim() ? q.trim().toLowerCase().split(/\s+/) : []
  const scored = products.map((p) => {
    let score = (p.giftScore ?? 5) / 10
    const matchedTags: string[] = []
    for (const t of terms) {
      if ((p.name || '').toLowerCase().includes(t)) { score += 0.2; matchedTags.push(p.name) }
      if ((p.aiSummary || '').toLowerCase().includes(t)) score += 0.15
      for (const tag of p.occasionTags || []) {
        if (tag.toLowerCase().includes(t)) { score += 0.1; matchedTags.push(tag) }
      }
    }
    return { product: p, score: Math.min(1, score), matchedTags: [...new Set(matchedTags)].slice(0, 5) }
  })
  scored.sort((a, b) => b.score - a.score)

  const results = scored.slice(0, 10).map((s, i) => ({
    productId: s.product.id,
    product: s.product,
    rank: i + 1,
    score: s.score,
    reason: s.product.aiSummary || `${s.product.brand}の${s.product.category}です。`,
    matchedTags: s.matchedTags,
  }))

  return {
    id: `rec_${Date.now()}`,
    query: q,
    filters: body.filters || {},
    results,
    createdAt: new Date().toISOString(),
  }
}
