import { useState, useEffect, useCallback } from 'react'
import IconSidebar from '../components/IconSidebar'
import HomeView from '../components/HomeView'
import EditorView from '../components/EditorView'
import CompanySlideOver from '../components/CompanySlideOver'
import { getCompany, getServices, getProposals, getProposal } from '../api/client'
import type { Company, Service, Proposal, ProposalSummary } from '../types'

export default function DashboardPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [proposals, setProposals] = useState<ProposalSummary[]>([])
  const [showSlideOver, setShowSlideOver] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [activeProposal, setActiveProposal] = useState<Proposal | null>(null)

  const refreshAll = useCallback(async () => {
    try {
      const [comp, svcs, props] = await Promise.all([
        getCompany(),
        getServices(),
        getProposals(),
      ])
      setCompany(comp)
      setServices(svcs)
      setProposals(props)
      if (!comp) setShowSlideOver(true)
    } catch {
      // API may not be ready
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  const handleSelectProposal = async (summary: ProposalSummary) => {
    try {
      const full = await getProposal(summary.id)
      setActiveProposal(full)
    } catch {
      // ignore
    }
  }

  const handleGoHome = () => {
    setActiveProposal(null)
  }

  if (!loaded) return null

  const activeView = activeProposal ? 'editor' : 'home'

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Icon sidebar */}
      <IconSidebar
        proposals={proposals}
        onSelectProposal={handleSelectProposal}
        onOpenSettings={() => setShowSlideOver(true)}
        onGoHome={handleGoHome}
        activeView={activeView as 'home' | 'editor'}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeProposal ? (
          <EditorView
            proposal={activeProposal}
            services={services}
            onNew={handleGoHome}
            onProposalGenerated={(p) => {
              setActiveProposal(p)
              refreshAll()
            }}
          />
        ) : (
          <HomeView
            services={services}
            onServicesChanged={refreshAll}
            onProposalGenerated={(p) => {
              setActiveProposal(p)
              refreshAll()
            }}
          />
        )}
      </div>

      <CompanySlideOver
        open={showSlideOver}
        isOnboarding={!company}
        onClose={() => setShowSlideOver(false)}
        onSaved={(c) => {
          setCompany(c)
          setShowSlideOver(false)
        }}
      />
    </div>
  )
}
