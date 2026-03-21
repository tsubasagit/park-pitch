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
import { auth } from '../lib/firebase'

const BASE = '/api'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const mergedHeaders = { ...authHeaders, ...(options?.headers as Record<string, string>) }
  const res = await fetch(`${BASE}${path}`, { ...options, headers: mergedHeaders })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `API error: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Company
export async function getCompany(): Promise<Company | null> {
  return request<Company | null>('/company')
}

export async function saveCompany(data: Omit<Company, 'updatedAt'>): Promise<Company> {
  return request<Company>('/company', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// Parse Request (テキスト→構造化データ抽出 + 商品レコメンド)
export async function parseRequest(text: string): Promise<{
  parsed: ParsedRequest
  recommendedProducts: (BloomingProduct & { rank: number; score: number; matchedTags: string[] })[]
}> {
  return request('/parse-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

// Proposals
export async function generateProposal(input: ProposalRequest): Promise<Proposal> {
  return request<Proposal>('/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function getProposals(): Promise<ProposalSummary[]> {
  return request<ProposalSummary[]>('/proposals')
}

export async function getProposal(id: string): Promise<Proposal> {
  return request<Proposal>(`/proposals/${id}`)
}

export async function updateProposal(id: string, jsonContent: ProposalJSON): Promise<Proposal> {
  return request<Proposal>(`/proposals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonContent }),
  })
}

// Blooming 商品カタログ
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
  const sp = new URLSearchParams()
  if (params?.page != null) sp.set('page', String(params.page))
  if (params?.perPage != null) sp.set('perPage', String(params.perPage))
  if (params?.q) sp.set('q', params.q)
  if (params?.keywords) sp.set('keywords', params.keywords)
  if (params?.category) sp.set('category', params.category)
  if (params?.brand) sp.set('brand', params.brand)
  if (params?.budgetMin != null) sp.set('budgetMin', String(params.budgetMin))
  if (params?.budgetMax != null) sp.set('budgetMax', String(params.budgetMax))
  if (params?.sort) sp.set('sort', params.sort)
  const qs = sp.toString()
  return request<{ items: BloomingProduct[]; total: number; page: number; perPage: number }>(
    `/blooming/products${qs ? `?${qs}` : ''}`,
  )
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
  return request<BloomingProduct>('/blooming/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function getBloomingProduct(id: string): Promise<BloomingProduct> {
  return request<BloomingProduct>(`/blooming/products/${encodeURIComponent(id)}`)
}

export async function getBloomingFilters(): Promise<{
  categories: string[]
  brands: string[]
  occasions: string[]
}> {
  return request('/blooming/filters')
}

export async function getBloomingRecommendations(limit?: number): Promise<BloomingRecommendation[]> {
  const q = limit != null ? `?limit=${limit}` : ''
  return request<BloomingRecommendation[]>(`/blooming/recommendations${q}`)
}

export async function searchBloomingRecommend(body: {
  query?: string
  filters?: BloomingSearchFilters
}): Promise<BloomingRecommendation> {
  return request<BloomingRecommendation>('/blooming/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
