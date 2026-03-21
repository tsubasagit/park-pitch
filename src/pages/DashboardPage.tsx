import { useState, useEffect, useCallback } from 'react'
import IconSidebar, { type AppView } from '../components/IconSidebar'
import HomeView from '../components/HomeView'
import EditorView from '../components/EditorView'
import CatalogView from '../components/blooming/BloomingHomeView'
import CompanySlideOver from '../components/CompanySlideOver'
import { getCompany, getProposals, getProposal } from '../api/client'
import { logout } from '../lib/firebase'
import type { Company, Proposal, ProposalSummary } from '../types'

export default function DashboardPage() {
  const [view, setView] = useState<AppView>('home')
  const [company, setCompany] = useState<Company | null>(null)
  const [proposals, setProposals] = useState<ProposalSummary[]>([])
  const [showSlideOver, setShowSlideOver] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [activeProposal, setActiveProposal] = useState<Proposal | null>(null)

  // 提案カート
  const [cartIds, setCartIds] = useState<Set<string>>(new Set())
  const toggleCart = useCallback((id: string) => {
    setCartIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])
  const clearCart = useCallback(() => setCartIds(new Set()), [])

  const refreshAll = useCallback(async () => {
    try {
      const [comp, props] = await Promise.all([
        getCompany(),
        getProposals(),
      ])
      setCompany(comp)
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
      setView('editor')
    } catch {
      // ignore
    }
  }

  const handleGoHome = () => {
    setActiveProposal(null)
    setView('home')
  }

  const handleGoCatalog = () => {
    setActiveProposal(null)
    setView('catalog')
  }

  if (!loaded) return null

  const currentView: AppView = activeProposal ? 'editor' : view

  return (
    <div className="h-screen flex bg-gray-50">
      <IconSidebar
        currentView={currentView}
        proposals={proposals}
        cartCount={cartIds.size}
        onSelectProposal={handleSelectProposal}
        onOpenSettings={() => setShowSlideOver(true)}
        onGoHome={handleGoHome}
        onGoCatalog={handleGoCatalog}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeProposal ? (
          <EditorView
            proposal={activeProposal}
            onNew={handleGoHome}
            onProposalGenerated={(p) => {
              setActiveProposal(p)
              refreshAll()
            }}
          />
        ) : view === 'catalog' ? (
          <CatalogView
            cartIds={cartIds}
            onToggleCart={toggleCart}
            onGoHome={() => { setView('home') }}
          />
        ) : (
          <HomeView
            cartIds={cartIds}
            onToggleCart={toggleCart}
            onClearCart={clearCart}
            proposalCount={proposals.length}
            onProposalGenerated={(p) => {
              setActiveProposal(p)
              setView('editor')
              clearCart()
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
