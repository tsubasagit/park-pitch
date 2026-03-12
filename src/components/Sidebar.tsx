import { favoriteCompanies, recentMinutesList } from '../data/mock'

interface SidebarProps {
  onFavoriteClick: (prompt: string) => void
  onMinutesClick: (summary: string) => void
  isOpen: boolean
  onClose?: () => void
}

export default function Sidebar({ onFavoriteClick, onMinutesClick, isOpen, onClose }: SidebarProps) {
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
          fixed lg:relative inset-y-0 left-0 z-30 lg:z-0
          transform transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ top: '3.5rem' }}
      >
        <div className="p-3 overflow-y-auto flex-1">
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
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>🕐</span> 最近の議事録
            </h2>
            <ul className="space-y-1">
              {recentMinutesList.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onMinutesClick(m.summary)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-park-navy/10 border-l-2 border-transparent hover:border-park-orange pl-3"
                  >
                    <span className="text-gray-500 text-xs block">{m.date}</span>
                    <span className="text-park-navy font-medium">{m.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </>
  )
}
