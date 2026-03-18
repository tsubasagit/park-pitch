import { useState, useRef, useEffect } from 'react'
import type { ProposalSummary } from '../types'

interface HistoryDropdownProps {
  proposals: ProposalSummary[]
  onSelect: (proposal: ProposalSummary) => void
}

export default function HistoryDropdown({ proposals, onSelect }: HistoryDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-white/70 hover:text-white hover:bg-white/10"
      >
        <span>履歴</span>
        <span className="text-xs">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-80 overflow-y-auto">
          {proposals.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">
              履歴がありません
            </div>
          ) : (
            proposals.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p)
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
              >
                <div className="text-sm font-medium text-gray-900 truncate">
                  {p.clientName || '御社'} 向け提案書
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  {p.serviceNames.join('、')}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {new Date(p.createdAt).toLocaleDateString('ja-JP')}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
