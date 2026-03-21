import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── URLs ─────────────────────────────────────────────
export const CSL_BASE_URL = 'https://classics-the-small-luxury.com'
export const CSL_SITEMAP_URL = `${CSL_BASE_URL}/sitemap_products_1.xml`

export const HG_BASE_URL = 'https://handkerchief-gallery.com'
export const HG_CATEGORY_URLS = [
  `${HG_BASE_URL}/products/list?category_id=7`,   // レディース
  `${HG_BASE_URL}/products/list?category_id=8`,   // メンズ
  `${HG_BASE_URL}/products/list?category_id=9`,   // キッズ
  `${HG_BASE_URL}/products/list?category_id=10`,  // タオル
  `${HG_BASE_URL}/products/list?category_id=11`,  // エコバッグ
]

export const RAKUTEN_SEARCH_URL = 'https://search.rakuten.co.jp/search/mall'
export const RAKUTEN_SHOP_KEYWORD = 'CLASSICS+the+Small+Luxury'
export const RAKUTEN_EXTRA_KEYWORDS = [
  'ブルーミング中西+ハンカチ',
  'ブルーミング中西+タオル',
  'ブルーミング中西+エコバッグ',
  'ブルーミング中西+ノベルティ',
]

// ─── Rate Limiting ────────────────────────────────────
export const REQUEST_DELAY_MS = 1000        // 1 second between requests
export const BATCH_SIZE = 20                 // AI enrichment batch size
export const MAX_CONCURRENT_REQUESTS = 3

// ─── Paths ────────────────────────────────────────────
export const DATA_DIR = path.join(__dirname, '..', 'data')
export const SCRAPED_CSL_PATH = path.join(DATA_DIR, 'scraped_csl.json')
export const SCRAPED_HG_PATH = path.join(DATA_DIR, 'scraped_hg.json')
export const SCRAPED_RAKUTEN_PATH = path.join(DATA_DIR, 'scraped_rakuten.json')
export const MERGED_PRODUCTS_PATH = path.join(DATA_DIR, 'blooming_products.json')
export const INDEX_PATH = path.join(DATA_DIR, 'blooming_index.json')

// ─── Helpers ──────────────────────────────────────────
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
