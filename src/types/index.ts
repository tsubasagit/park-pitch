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

export interface ServiceFeature {
  name: string
  description: string
}

export interface Service {
  id: string
  name: string
  category: string
  overview: string
  targetClients: string
  challengesSolved: string[]
  deliverables: ServiceFeature[]
  expertType: string
  engagementType: string
  pdfFilename: string
  pdfOriginalName: string
  createdAt: string
  updatedAt: string
}

export interface HearingInput {
  clientName?: string
  serviceIds: string[]
  challenge: string
  budget: string
  timeline: string
}

export interface Proposal {
  id: string
  serviceIds: string[]
  serviceNames: string[]
  clientName: string
  hearingInput: HearingInput
  markdownContent: string
  createdAt: string
}

export type ProposalSummary = Omit<Proposal, 'markdownContent'>
