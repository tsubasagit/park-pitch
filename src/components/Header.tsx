export default function Header() {
  return (
    <header className="bg-park-navy text-white shrink-0">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">PARK</span>
          <span className="text-sm text-white/70">営業AI</span>
        </div>
        <button
          type="button"
          className="p-2 rounded text-white/70 hover:text-white hover:bg-white/10"
          title="設定"
          aria-label="設定"
        >
          <span className="text-lg">⚙</span>
        </button>
      </div>
    </header>
  )
}
