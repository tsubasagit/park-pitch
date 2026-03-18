import HistoryDropdown from './HistoryDropdown'
import type { ProposalSummary } from '../types'

interface HeaderProps {
  proposals: ProposalSummary[]
  onSelectProposal: (proposal: ProposalSummary) => void
  onOpenSettings: () => void
}

export default function Header({ proposals, onSelectProposal, onOpenSettings }: HeaderProps) {
  return (
    <header className="bg-pitch-navy text-white shrink-0 print:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">Park-Pitch</span>
          <span className="text-sm text-white/70">提案書ジェネレーター</span>
        </div>
        <div className="flex items-center gap-2">
          <HistoryDropdown
            proposals={proposals}
            onSelect={onSelectProposal}
          />
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded text-white/70 hover:text-white hover:bg-white/10"
            title="会社プロフィール設定"
            aria-label="設定"
          >
            <span className="text-lg">⚙</span>
          </button>
        </div>
      </div>
    </header>
  )
}
