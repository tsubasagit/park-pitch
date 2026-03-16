interface HeaderProps {
  onSettingsClick: () => void
  onNavAction: (prompt: string) => void
}

const WORKSPACE_TABS = [
  { icon: '📊', label: '商談', prompt: '案件一覧' },
  { icon: '🏢', label: '会社', prompt: '会社一覧' },
  { icon: '📄', label: '議事録', prompt: '議事録一覧' },
  { icon: '📋', label: '提案書', prompt: '提案書を作成して' },
]

export default function Header({ onSettingsClick, onNavAction }: HeaderProps) {
  return (
    <header className="bg-park-navy text-white shrink-0">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">PARK</span>
          <span className="text-sm text-white/70">営業エディタ</span>
        </div>
        <button
          type="button"
          onClick={onSettingsClick}
          className="p-2 rounded text-white/70 hover:text-white hover:bg-white/10"
          title="設定"
          aria-label="設定"
        >
          <span className="text-lg">⚙</span>
        </button>
      </div>
      {/* ワークスペースタブ */}
      <nav className="flex items-center px-4 h-10 bg-park-navyLight/80 gap-1">
        {WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.prompt}
            type="button"
            onClick={() => onNavAction(tab.prompt)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-t text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </header>
  )
}
