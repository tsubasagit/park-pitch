/**
 * 商品データをエンリッチメント（Gemini API またはモック）
 * occasionTags, useCaseTags, seasonality, giftScore, aiSummary, priceSegment を付与
 */
import 'dotenv/config'
import fs from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MERGED_PRODUCTS_PATH, INDEX_PATH, DATA_DIR, BATCH_SIZE, sleep } from './config'

// ─── Types ───────────────────────────────────────────

interface MergedProduct {
  mergedId: string
  id: string
  source: string
  sourceUrl: string
  name: string
  brand: string
  price: number
  materials: string[]
  dimensions: string
  colors: string[]
  category: string
  gender: string
  collections: string[]
  thumbnailUrl: string
  imageUrls: string[]
  scrapedAt: string
  sources: Array<{ source: string; sourceUrl: string; price: number }>
}

interface EnrichmentResult {
  mergedId: string
  occasionTags: string[]
  useCaseTags: string[]
  seasonality: string[]
  giftScore: number
  priceSegment: string
  aiSummary: string
}

interface BloomingProductOutput {
  id: string
  source: 'handkerchief-gallery' | 'classics' | 'rakuten'
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
  enrichedAt: string
}

interface IndexEntry {
  id: string
  name: string
  price: number
  brand: string
  category: string
  gender: string
  occasionTags: string[]
  giftScore: number
  priceSegment: string
  thumbnailUrl: string
  sourceUrl: string
}

// ─── Gemini（実APIはここで差し替え可能）────────────────

const apiKey = process.env.GEMINI_API_KEY
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null
const modelId = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const model = genAI ? genAI.getGenerativeModel({ model: modelId }) : null

// ─── Helpers ─────────────────────────────────────────

function derivePriceSegment(price: number): 'budget' | 'mid' | 'premium' | 'luxury' {
  if (price <= 2000) return 'budget'
  if (price <= 5000) return 'mid'
  if (price <= 10000) return 'premium'
  return 'luxury'
}

function buildEnrichPrompt(products: MergedProduct[]): string {
  const items = products.map((p) => ({
    mergedId: p.mergedId,
    name: p.name,
    price: p.price,
    brand: p.brand,
    category: p.category,
    gender: p.gender,
    materials: p.materials.join(', '),
    colors: p.colors.join(', '),
  }))

  return `以下の商品データにAIエンリッチメントを付与してください。

各商品に対して以下のフィールドを生成:
- occasionTags: 贈答シーン（例: ["結婚祝い", "10周年記念", "退職祝い"]）。最大5個
- useCaseTags: 用途（例: ["法人ギフト", "ノベルティ", "自分用"]）。最大3個
- seasonality: 季節・時期（例: ["春", "母の日", "年末"]）。最大3個
- giftScore: ギフト適性スコア（1-10の整数）
- priceSegment: "budget"(〜2000円) / "mid"(〜5000円) / "premium"(〜10000円) / "luxury"(10000円〜)
- aiSummary: 30-50文字の日本語キャッチコピー

JSON配列のみを返してください。マークダウンのコードフェンスは不要です。

商品データ:
${JSON.stringify(items, null, 2)}`
}

async function enrichBatch(batch: MergedProduct[]): Promise<EnrichmentResult[]> {
  if (!model) return batch.map((p) => mockEnrichOne(p))
  const prompt = buildEnrichPrompt(batch)
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const parsed = JSON.parse(cleaned) as EnrichmentResult[]
  return parsed.map((r) => ({
    ...r,
    useCaseTags: r.useCaseTags ?? [],
    seasonality: r.seasonality ?? [],
  }))
}

function mockEnrichOne(p: MergedProduct): EnrichmentResult {
  return {
    mergedId: p.mergedId,
    occasionTags: ['ギフト', '記念品'],
    useCaseTags: ['法人ギフト', 'ノベルティ'],
    seasonality: [],
    giftScore: 5,
    priceSegment: derivePriceSegment(p.price),
    aiSummary: `${p.brand} ${p.category} - ${p.name}`.slice(0, 50),
  }
}

function buildIndex(products: BloomingProductOutput[]): IndexEntry[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    brand: p.brand,
    category: p.category,
    gender: p.gender,
    occasionTags: p.occasionTags || [],
    giftScore: p.giftScore || 5,
    priceSegment: p.priceSegment || derivePriceSegment(p.price),
    thumbnailUrl: p.thumbnailUrl,
    sourceUrl: p.sourceUrl,
  }))
}

// ─── Main ────────────────────────────────────────────

async function enrichProducts(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(MERGED_PRODUCTS_PATH)) {
    console.error(`[Enrich] ${MERGED_PRODUCTS_PATH} が見つかりません。先に mergeProducts を実行してください。`)
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(MERGED_PRODUCTS_PATH, 'utf-8')) as unknown[]
  if (!Array.isArray(raw) || raw.length === 0) {
    console.error('[Enrich] 有効な商品データがありません。')
    process.exit(1)
  }
  // 既にエンリッチ済み（id + enrichedAt あり）ならインデックスのみ再構築
  const first = raw[0] as Record<string, unknown>
  if (first.enrichedAt && first.id && !first.mergedId) {
    console.log('[Enrich] 既にエンリッチ済み。インデックスのみ再構築します。')
    const index = buildIndex(raw as BloomingProductOutput[])
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8')
    console.log(`[Enrich] Index saved: ${INDEX_PATH} (${index.length} entries)`)
    return
  }

  const merged = raw as MergedProduct[]
  console.log(`[Enrich] ${merged.length} 商品を読み込み`)
  if (!apiKey) console.log('[Enrich] GEMINI_API_KEY 未設定 → モックエンリッチで出力します')

  const toEnrich = merged
  const enrichMap = new Map<string, EnrichmentResult>()
  const totalBatches = Math.ceil(toEnrich.length / BATCH_SIZE)

  for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const batch = toEnrich.slice(i, i + BATCH_SIZE)
    if (apiKey) console.log(`[Enrich] Batch ${batchNum}/${totalBatches} (${batch.length} items)...`)

    try {
      const results = await enrichBatch(batch)
      for (const r of results) {
        enrichMap.set(r.mergedId, r)
      }
    } catch (err) {
      if (apiKey) console.error(`[Enrich] Batch ${batchNum} 失敗、fallback値を使用:`, err)
      for (const p of batch) {
        enrichMap.set(p.mergedId, mockEnrichOne(p))
      }
    }
    if (apiKey && i + BATCH_SIZE < toEnrich.length) await sleep(2000)
  }

  const now = new Date().toISOString()
  const sourceTyped = (s: string): BloomingProductOutput['source'] =>
    s === 'classics' || s === 'rakuten' ? s : 'handkerchief-gallery'
  const genderTyped = (g: string): BloomingProductOutput['gender'] =>
    (g === 'mens' || g === 'womens' || g === 'kids' || g === 'unisex' ? g : '') as BloomingProductOutput['gender']
  const segmentTyped = (v: string): BloomingProductOutput['priceSegment'] =>
    (v === 'budget' || v === 'mid' || v === 'premium' || v === 'luxury' ? v : derivePriceSegment(0)) as BloomingProductOutput['priceSegment']

  const products: BloomingProductOutput[] = merged.map((p) => {
    const e = enrichMap.get(p.mergedId) ?? mockEnrichOne(p)
    return {
      id: p.mergedId,
      source: sourceTyped(p.source),
      sourceUrl: p.sourceUrl,
      name: p.name,
      brand: p.brand,
      price: p.price,
      materials: p.materials,
      dimensions: p.dimensions || undefined,
      colors: p.colors,
      category: p.category,
      gender: genderTyped(p.gender),
      collections: p.collections,
      occasionTags: e.occasionTags ?? [],
      useCaseTags: e.useCaseTags ?? [],
      priceSegment: segmentTyped(e.priceSegment),
      giftScore: e.giftScore ?? 5,
      seasonality: e.seasonality ?? [],
      aiSummary: e.aiSummary ?? `${p.brand} ${p.category}`,
      thumbnailUrl: p.thumbnailUrl,
      imageUrls: p.imageUrls,
      scrapedAt: p.scrapedAt,
      enrichedAt: now,
    }
  })

  fs.writeFileSync(MERGED_PRODUCTS_PATH, JSON.stringify(products, null, 2), 'utf-8')
  console.log(`[Enrich] Products saved: ${MERGED_PRODUCTS_PATH} (${products.length} items)`)

  const index = buildIndex(products)
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8')
  console.log(`[Enrich] Index saved: ${INDEX_PATH} (${index.length} entries)`)
}

// CLI実行
if (process.argv[1]?.endsWith('enrichProducts.ts')) {
  enrichProducts().catch(console.error)
}

export { enrichProducts }
