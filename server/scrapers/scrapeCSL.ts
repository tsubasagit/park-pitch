/**
 * CLASSICS the Small Luxury (Shopify) スクレイパー
 * Shopifyのsitemap → 各商品の .json エンドポイントから取得
 */
import * as cheerio from 'cheerio'
import fs from 'fs'
import { CSL_BASE_URL, CSL_SITEMAP_URL, REQUEST_DELAY_MS, SCRAPED_CSL_PATH, DATA_DIR, sleep } from './config'

interface CSLRawProduct {
  id: string
  source: 'classics'
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
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ParkPitch-Scraper/1.0 (product-catalog)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.text()
}

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ParkPitch-Scraper/1.0 (product-catalog)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.json()
}

/** sitemap_products_1.xml からの商品URL一覧を取得 */
async function getProductUrlsFromSitemap(): Promise<string[]> {
  console.log('[CSL] Fetching sitemap:', CSL_SITEMAP_URL)
  const xml = await fetchText(CSL_SITEMAP_URL)
  const $ = cheerio.load(xml, { xmlMode: true })
  const urls: string[] = []
  $('url > loc').each((_, el) => {
    const loc = $(el).text().trim()
    if (loc.includes('/products/') && !loc.includes('/collections/')) {
      urls.push(loc)
    }
  })
  console.log(`[CSL] Found ${urls.length} product URLs in sitemap`)
  return urls
}

/** Shopify .json endpoint から商品データを取得 */
function parseShopifyProduct(data: Record<string, unknown>, sourceUrl: string): CSLRawProduct {
  const product = data.product as Record<string, unknown>
  const variants = (product.variants as Array<Record<string, unknown>>) || []
  const images = (product.images as Array<Record<string, string>>) || []
  const tags = ((product.tags as string) || '').split(',').map((t: string) => t.trim()).filter(Boolean)

  // 価格: 最安バリアントを取得
  const prices = variants.map((v) => Number(v.price)).filter((p) => p > 0)
  const price = prices.length > 0 ? Math.min(...prices) : 0

  // 色: バリアントのoption1から
  const colors = [...new Set(variants.map((v) => String(v.option1 || '')).filter(Boolean))]

  // 性別推定
  let gender = ''
  const titleLower = String(product.title || '').toLowerCase()
  const tagStr = tags.join(' ').toLowerCase()
  if (tagStr.includes('メンズ') || tagStr.includes('mens') || titleLower.includes('メンズ')) gender = 'mens'
  else if (tagStr.includes('レディース') || tagStr.includes('womens') || titleLower.includes('レディース')) gender = 'womens'
  else if (tagStr.includes('キッズ') || tagStr.includes('kids')) gender = 'kids'

  // カテゴリ推定
  let category = 'ハンカチ'
  if (tagStr.includes('タオル') || titleLower.includes('タオル')) category = 'タオル'
  else if (tagStr.includes('エコバッグ') || titleLower.includes('エコバッグ') || titleLower.includes('bag')) category = 'エコバッグ'
  else if (tagStr.includes('ノベルティ')) category = 'ノベルティ'

  // 素材: bodyからの抽出試行
  const bodyHtml = String(product.body_html || '')
  const materials: string[] = []
  const materialPatterns = ['綿', 'コットン', 'シルク', '絹', 'リネン', '麻', 'ポリエステル', 'ナイロン', 'レーヨン']
  for (const mat of materialPatterns) {
    if (bodyHtml.includes(mat) || tagStr.includes(mat.toLowerCase())) {
      materials.push(mat)
    }
  }

  return {
    id: `csl_${product.id}`,
    source: 'classics',
    sourceUrl,
    name: String(product.title || ''),
    brand: String(product.vendor || 'CLASSICS the Small Luxury'),
    price,
    materials,
    dimensions: '',
    colors,
    category,
    gender,
    collections: tags,
    thumbnailUrl: images[0]?.src || '',
    imageUrls: images.map((img) => img.src),
    scrapedAt: new Date().toISOString(),
  }
}

/** モック用サンプルデータを出力（ネットワーク不要） */
function writeMockCSL(): CSLRawProduct[] {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const now = new Date().toISOString()
  const products: CSLRawProduct[] = [
    { id: 'csl_mock_1', source: 'classics', sourceUrl: 'https://classics-the-small-luxury.com/products/sample1', name: 'シルクハンカチ 花柄', brand: 'CLASSICS the Small Luxury', price: 2200, materials: ['シルク'], dimensions: '', colors: ['ピンク', 'ブルー'], category: 'ハンカチ', gender: 'womens', collections: ['ギフト'], thumbnailUrl: '', imageUrls: [], scrapedAt: now },
    { id: 'csl_mock_2', source: 'classics', sourceUrl: 'https://classics-the-small-luxury.com/products/sample2', name: '綿タオル ロゴ入り', brand: 'CLASSICS the Small Luxury', price: 880, materials: ['綿'], dimensions: '34×34cm', colors: ['白'], category: 'タオル', gender: 'unisex', collections: ['ノベルティ'], thumbnailUrl: '', imageUrls: [], scrapedAt: now },
    { id: 'csl_mock_3', source: 'classics', sourceUrl: 'https://classics-the-small-luxury.com/products/sample3', name: 'メンズハンカチ ストライプ', brand: 'CLASSICS the Small Luxury', price: 1650, materials: ['綿'], dimensions: '', colors: ['ネイビー', 'グレー'], category: 'ハンカチ', gender: 'mens', collections: [], thumbnailUrl: '', imageUrls: [], scrapedAt: now },
  ]
  fs.writeFileSync(SCRAPED_CSL_PATH, JSON.stringify(products, null, 2), 'utf-8')
  console.log(`[CSL] Mock: wrote ${products.length} samples to ${SCRAPED_CSL_PATH}`)
  return products
}

export async function scrapeCSL(): Promise<CSLRawProduct[]> {
  const useMock = process.env.MOCK === '1' || process.argv.includes('--mock')
  if (useMock) return writeMockCSL()

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  const productUrls = await getProductUrlsFromSitemap()
  const products: CSLRawProduct[] = []
  let errors = 0

  for (let i = 0; i < productUrls.length; i++) {
    const url = productUrls[i]
    const jsonUrl = `${url}.json`

    try {
      const data = await fetchJSON(jsonUrl) as Record<string, unknown>
      const product = parseShopifyProduct(data, url)
      products.push(product)

      if ((i + 1) % 50 === 0) {
        console.log(`[CSL] Progress: ${i + 1}/${productUrls.length} (${errors} errors)`)
      }
    } catch (err) {
      errors++
      if (errors <= 5) console.error(`[CSL] Error fetching ${jsonUrl}:`, (err as Error).message)
    }

    await sleep(REQUEST_DELAY_MS)
  }

  console.log(`[CSL] Done: ${products.length} products scraped, ${errors} errors`)
  fs.writeFileSync(SCRAPED_CSL_PATH, JSON.stringify(products, null, 2), 'utf-8')
  console.log(`[CSL] Saved to ${SCRAPED_CSL_PATH}`)

  return products
}

// CLI実行
if (process.argv[1]?.endsWith('scrapeCSL.ts')) {
  scrapeCSL().catch(console.error)
}
