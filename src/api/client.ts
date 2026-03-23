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
import { GoogleGenerativeAI } from '@google/generative-ai'

const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null

function getModel() {
  if (!genAI) throw new Error('VITE_GEMINI_API_KEY が未設定です')
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
}

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

// ─── Parse Request (Gemini直接) ──────────────────────

const TEXT_EXTRACTION_PROMPT = `あなたはB2B法人営業の情報抽出アシスタントです。
営業担当者が入力したテキストから、ノベルティ/ギフト商品の提案に必要な情報を構造化JSONで抽出してください。

出力は以下のJSON形式のみで返してください（説明文やマークダウンは不要）:

{
  "clientName": "提案先企業名（不明なら空文字）",
  "purpose": "用途・キャンペーン内容（不明なら空文字）",
  "quantity": null,
  "unitPriceMin": null,
  "unitPriceMax": null,
  "deliveryDate": "YYYY-MM-DD形式（不明ならnull）",
  "customization": "名入れ・印刷等の要望（不明なら空文字）",
  "keywords": ["商品検索に使えるキーワード"]
}

注意:
- 数量(quantity)は数値で返してください（例: 19300）
- 単価は円単位の数値で返してください（例: 250, 300）
- 「250-300円」のような表記はunitPriceMin: 250, unitPriceMax: 300として抽出
- 納期は可能な限りYYYY-MM-DD形式に変換（月だけなら末日を設定）
- keywordsは商品カタログ検索用（例: ["保冷バッグ", "エコバッグ", "夏"]）`

export async function parseRequest(text: string): Promise<{
  parsed: ParsedRequest
  recommendedProducts: (BloomingProduct & { rank: number; score: number; matchedTags: string[] })[]
}> {
  const model = getModel()
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: TEXT_EXTRACTION_PROMPT + '\n\n入力テキスト:\n' + text }] }],
  })
  const raw = result.response.text().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const parsed = JSON.parse(raw) as ParsedRequest & { keywords?: string[] }

  // キーワードで商品検索してレコメンド
  const keywords = (parsed as { keywords?: string[] }).keywords || []
  const q = keywords.join(' ')
  const { items: candidates } = await getBloomingProducts({ q, perPage: 50 })

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  const scored = candidates.map((p) => {
    let score = (p.giftScore ?? 5) / 10
    const matchedTags: string[] = []
    for (const t of terms) {
      if ((p.name || '').toLowerCase().includes(t)) { score += 0.2; matchedTags.push(p.name) }
      if ((p.aiSummary || '').toLowerCase().includes(t)) score += 0.15
      for (const tag of p.occasionTags || []) {
        if (tag.toLowerCase().includes(t)) { score += 0.1; matchedTags.push(tag) }
      }
    }
    return { ...p, score: Math.min(1, score), rank: 0, matchedTags: [...new Set(matchedTags)].slice(0, 5) }
  })
  scored.sort((a, b) => b.score - a.score)
  const recommendedProducts = scored.slice(0, 10).map((s, i) => ({ ...s, rank: i + 1 }))

  return { parsed, recommendedProducts }
}

// ─── Generate Proposal (Gemini直接) ──────────────────

export async function generateProposal(input: ProposalRequest): Promise<Proposal> {
  const model = getModel()

  // 会社情報取得
  const company = await getCompany()
  if (!company) throw new Error('会社プロフィールが未設定です。先に設定してください。')

  // 選択商品取得
  const allProducts = await loadAllProducts()
  const selectedProducts = allProducts.filter((p) => input.productIds.includes(p.id))
  if (selectedProducts.length === 0) throw new Error('商品を1つ以上選択してください。')

  // プロンプト構築
  const productText = selectedProducts.map((p, i) =>
    `### 商品${i + 1}: ${p.name}
- ID: ${p.id}
- ブランド: ${p.brand}
- 参考価格: ¥${p.price.toLocaleString()}
- 素材: ${(p.materials || []).join('、') || '不明'}
- サイズ: ${p.dimensions || '不明'}
- カラー展開: ${(p.colors || []).join('、') || '不明'}
- カテゴリ: ${p.category}
- タグ: ${(p.occasionTags || []).join('、')}
- 概要: ${p.aiSummary || ''}
- 画像URL: ${p.thumbnailUrl || ''}`
  ).join('\n\n')

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

  const prompt = `あなたはブルーミング中西のノベルティ/ギフト商品提案書を作成する営業支援AIです。
以下の情報から、提案書の構造化JSONを生成してください。

【自社情報】
- 会社名: ${company.name}
- 概要: ${company.description}
- 理念: ${company.philosophy || ''}
- 強み: ${(company.strengths || []).join('、')}
- 担当者: ${company.contactPerson || ''}
- Email: ${company.email || ''}

【提案商品】
${productText}

【提案先・要件】
- 企業名: ${input.clientName || '御社'}
- 用途: ${input.purpose || '（未指定）'}
- 数量: ${input.quantity ? `${input.quantity.toLocaleString()}個` : '（未指定）'}
- 単価帯: ${input.unitPriceMin || input.unitPriceMax ? `¥${input.unitPriceMin || '?'}〜¥${input.unitPriceMax || '?'}` : '（未指定）'}
- 納品希望: ${input.deliveryDate || '（未指定）'}
- カスタマイズ: ${input.customization || '（未指定）'}

【出力形式】
以下のJSON形式で出力してください。JSONのみで返してください:

{
  "cover": {
    "title": "提案書タイトル",
    "subtitle": "サブタイトル",
    "clientName": "${input.clientName || '御社'}",
    "companyName": "${company.name}",
    "contactPerson": "${company.contactPerson || ''}",
    "date": "${today}"
  },
  "greeting": "ご挨拶文（2-3文）",
  "products": [
    {
      "productId": "商品ID",
      "name": "商品名",
      "description": "商品の特徴・おすすめポイント（3-4文）",
      "imageUrl": "画像URL",
      "specs": {
        "material": "素材",
        "size": "サイズ",
        "colors": ["カラー1", "カラー2"],
        "customization": "名入れ方法",
        "unitPrice": "¥XXX",
        "quantity": "XX,XXX個",
        "deliveryDays": "約XX営業日"
      },
      "recommendation": "この商品が適している理由（1-2文）"
    }
  ],
  "comparison": {
    "comment": "商品比較のコメント（1-2文）",
    "table": [{ "name": "商品名", "price": "¥XXX", "material": "素材", "size": "サイズ", "customization": "名入れ", "deliveryDays": "納期" }]
  },
  "delivery": { "timeline": "納品スケジュール概要", "notes": ["注意事項"] },
  "pricing": {
    "summary": "お見積もり概要",
    "breakdown": [{ "item": "商品名", "unitPrice": "¥XXX", "quantity": "XX個", "subtotal": "¥X,XXX" }],
    "total": "¥X,XXX,XXX（税別）"
  },
  "companyInfo": {
    "name": "${company.name}",
    "description": "${company.description || ''}",
    "strengths": ${JSON.stringify(company.strengths || [])},
    "contact": "${company.contactPerson || ''}",
    "email": "${company.email || ''}"
  }
}

注意:
- 各商品の仕様は提供された情報から正確に記述してください
- 名入れ方法は商品の素材に適した方法を提案してください
- 提案先企業の用途に合わせたトーンで記述してください`

  const genResult = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })
  const jsonText = genResult.response.text().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const jsonContent = JSON.parse(jsonText) as ProposalJSON

  // Firestoreに保存（undefinedフィールドを除去 — Firestoreはundefinedを受け付けない）
  const cleanInput = JSON.parse(JSON.stringify(input)) as ProposalRequest
  const proposal = {
    productIds: input.productIds,
    productNames: selectedProducts.map((p) => p.name),
    clientName: input.clientName || '御社',
    proposalRequest: cleanInput,
    jsonContent,
    createdAt: new Date().toISOString(),
  }
  const ref = await addDoc(collection(db, 'proposals'), proposal)
  return { id: ref.id, ...proposal }
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
