export interface Company {
  name: string
  industry: string
  description: string
  philosophy: string
  expertise: string
  offices: string
  strengths: string[]
  contactPerson: string
  email: string
  logoPath?: string
  updatedAt: string
}

export const PRODUCT_CATEGORIES = [
  'タオル',
  'ハンカチ',
  'エコバッグ',
  'ノベルティ',
  'その他',
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

// --- ProposalRequest: テキスト入力→構造化データ ---

export interface ProposalRequest {
  freeText: string          // 元のテキスト入力
  clientName: string        // 提案先企業名
  purpose: string           // 用途・キャンペーン内容
  productIds: string[]      // 選択した商品ID
  quantity?: number         // 発注数量
  unitPriceMin?: number     // 単価下限
  unitPriceMax?: number     // 単価上限
  deliveryDate?: string     // 納品希望日
  customization?: string    // 名入れ・印刷等の要望
}

export interface ParsedRequest {
  clientName: string
  purpose: string
  quantity?: number
  unitPriceMin?: number
  unitPriceMax?: number
  deliveryDate?: string
  customization?: string
}

// --- Proposal ---

export interface Proposal {
  id: string
  productIds: string[]
  productNames: string[]
  clientName: string
  proposalRequest: ProposalRequest
  jsonContent: ProposalJSON
  createdAt: string
}

export type ProposalSummary = Omit<Proposal, 'jsonContent'>

// --- ProposalJSON: AIが生成する構造化データ ---

export interface ProposalJSON {
  cover: {
    title: string
    subtitle: string
    clientName: string
    companyName: string
    contactPerson: string
    date: string
  }
  greeting: string
  products: ProposalProductSection[]
  comparison?: {
    comment: string
    table: Array<{
      name: string
      price: string
      material: string
      size: string
      customization: string
      deliveryDays: string
    }>
  }
  delivery: {
    timeline: string
    notes: string[]
  }
  pricing: {
    summary: string
    breakdown?: Array<{
      item: string
      unitPrice: string
      quantity: string
      subtotal: string
    }>
    total?: string
  }
  companyInfo: {
    name: string
    description: string
    strengths: string[]
    contact: string
    email: string
  }
}

export interface ProposalProductSection {
  productId: string
  name: string
  description: string
  imageUrl?: string
  specs: {
    material: string
    size: string
    colors: string[]
    customization: string
    unitPrice: string
    quantity: string
    deliveryDays: string
  }
  recommendation: string
}

// --- Blooming 商品レコメンド ---

export type BloomingSource = 'handkerchief-gallery' | 'classics' | 'rakuten'

export interface BloomingProduct {
  id: string
  source: BloomingSource
  sourceUrl: string
  name: string
  brand: string
  price: number
  materials: string[]
  dimensions?: string
  colors: string[]
  category: string
  gender: 'mens' | 'womens' | 'kids' | 'unisex' | ''
  collections: string[]
  occasionTags: string[]
  useCaseTags: string[]
  priceSegment: 'budget' | 'mid' | 'premium' | 'luxury'
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

export interface BloomingRecommendationItem {
  productId: string
  product: BloomingProduct
  rank: number
  score: number
  reason: string
  matchedTags: string[]
}

export interface BloomingRecommendation {
  id: string
  query: string
  filters: BloomingSearchFilters
  results: BloomingRecommendationItem[]
  createdAt: string
}
