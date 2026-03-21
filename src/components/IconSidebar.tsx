import { useState } from 'react'
import type { ProposalSummary } from '../types'

export type AppView = 'home' | 'catalog' | 'editor'

interface IconSidebarProps {
  currentView: AppView
  proposals: ProposalSummary[]
  cartCount: number
  onSelectProposal: (p: ProposalSummary) => void
  onOpenSettings: () => void
  onGoHome: () => void
  onGoCatalog: () => void
  onLogout: () => void
}

export default function IconSidebar({
  currentView,
  proposals,
  cartCount,
  onSelectProposal,
  onOpenSettings,
  onGoHome,
  onGoCatalog,
  onLogout,
}: IconSidebarProps) {
  return (
    <aside className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 shrink-0 print:hidden">
      {/* Logo */}
      <button
        type="button"
        onClick={onGoHome}
        className="w-9 h-9 rounded-lg bg-pitch-navy text-white flex items-center justify-center text-sm font-bold mb-3"
        title="Park-Pitch"
      >
        P
      </button>

      {/* Home */}
      <SidebarIcon
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
        }
        label="新規"
        active={currentView === 'home'}
        onClick={onGoHome}
      />

      {/* Catalog */}
      <div className="relative">
        <SidebarIcon
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          label="カタログ"
          active={currentView === 'catalog'}
          onClick={onGoCatalog}
        />
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center pointer-events-none">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </div>

      {/* History */}
      <HistorySidebarItem proposals={proposals} onSelect={onSelectProposal} />

      <div className="flex-1" />

      {/* Settings */}
      <SidebarIcon
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
        label="設定"
        onClick={onOpenSettings}
      />

      {/* Logout */}
      <SidebarIcon
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        }
        label="ログアウト"
        onClick={onLogout}
      />
    </aside>
  )
}

function SidebarIcon({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center transition-colors ${
        active ? 'bg-pitch-navy/10 text-pitch-navy' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span className="text-[9px] mt-0.5 leading-none">{label}</span>
    </button>
  )
}

function HistorySidebarItem({
  proposals,
  onSelect,
}: {
  proposals: ProposalSummary[]
  onSelect: (p: ProposalSummary) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <SidebarIcon
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        label="履歴"
        onClick={() => setOpen(!open)}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-full top-0 ml-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-80 overflow-y-auto">
            {proposals.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">履歴がありません</div>
            ) : (
              proposals.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p)
                    setOpen(false)
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {p.clientName || '御社'} 向け
                  </div>
                  <div className="text-xs text-gray-500 truncate">{p.productNames.join('、')}</div>
                  <div className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('ja-JP')}</div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
