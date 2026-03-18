import type { Company, Service, Proposal, ProposalSummary, HearingInput } from '../types'

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options)
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

export async function saveCompany(data: FormData): Promise<Company> {
  return request<Company>('/company', { method: 'POST', body: data })
}

// Services
export async function getServices(): Promise<Service[]> {
  return request<Service[]>('/services')
}

export async function createService(formData: FormData): Promise<Service> {
  return request<Service>('/services', { method: 'POST', body: formData })
}

export async function updateService(id: string, data: Partial<Service>): Promise<Service> {
  return request<Service>(`/services/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function deleteService(id: string): Promise<void> {
  await request<{ ok: boolean }>(`/services/${id}`, { method: 'DELETE' })
}

// Proposals
export async function generateProposal(input: HearingInput): Promise<Proposal> {
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

export async function updateProposal(id: string, markdownContent: string): Promise<Proposal> {
  return request<Proposal>(`/proposals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdownContent }),
  })
}
