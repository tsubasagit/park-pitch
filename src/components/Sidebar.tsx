import { favoriteCompanies, recentMinutesList, deals, dealStatusIcon } from '../data/mock'

/** ナビゲーションボタン定義 */
const NAV_BUTTONS = [
  { icon: '📋', label: '案件一覧', prompt: '案件一覧' },
  { icon: '🏢', label: '会社一覧', prompt: '会社一覧' },
  { icon: '📝', label: '議事録一覧', prompt: '議事録一覧' },
]

interface SidebarProps {
  onNavAction: (prompt: string) => void
  onFavoriteClick: (prompt: string) => void
  onMinutesClick: (summary: string) => void
  onDealClick: (prompt: string) => void
  isOpen: boolean
  onClose?: () => void
}

export default function Sidebar({ onNavAction, onFavoriteClick, onMinutesClick, onDealClick, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* モバイル: オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`
          w-56 shrink-0 bg-gray-100 border-r border-gray-200 flex flex-col
          fixed lg:relative left-0 top-[3.5rem] bottom-0 lg:top-auto lg:bottom-auto z-30 lg:z-0
          transform transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-3 overflow-y-auto flex-1">
          {/* ナビゲーションボタン */}
          <section className="mb-4 space-y-1.5">
            {NAV_BUTTONS.map((btn) => (
              <button
                key={btn.prompt}
                type="button"
                onClick={() => { onNavAction(btn.prompt); onClose?.() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-park-navy hover:text-white hover:border-park-navy transition-colors"
              >
                <span className="text-base">{btn.icon}</span>
                <span>{btn.label}</span>
              </button>
            ))}
          </section>

          {/* お気に入り */}
          <section className="mb-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>📌</span> お気に入り
            </h2>
            <ul className="space-y-0.5">
              {favoriteCompanies.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onFavoriteClick(c.prompt)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-park-navy hover:bg-park-navy/10 flex items-center gap-2"
                  >
                    <span className="text-park-orange">▸</span>
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* 最近 — 案件と議事録を統合して直近順に表示 */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>🕐</span> 最近
            </h2>
            <ul className="space-y-1">
              {recentMinutesList.map((m) => {
                const deal = deals.find((d) => d.minuteIds.includes(m.id))
                const statusIcon = deal ? dealStatusIcon(deal.status) : '📝'
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => deal ? onDealClick(deal.prompt) : onMinutesClick(m.summary)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-park-navy/10 border-l-2 border-transparent hover:border-park-orange pl-3"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{statusIcon}</span>
                        <span className="text-park-navy font-medium truncate">
                          {deal ? `${deal.company} ${deal.title}` : m.title}
                        </span>
                      </div>
                      <span className="text-gray-400 text-xs block mt-0.5">{m.date} {m.title}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </aside>
    </>
  )
}
