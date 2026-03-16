interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onClearHistory: () => void
}

export default function SettingsModal({ isOpen, onClose, onClearHistory }: SettingsModalProps) {
  if (!isOpen) return null

  const handleClear = () => {
    if (window.confirm('会話履歴をすべて削除しますか？')) {
      onClearHistory()
      onClose()
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
          <h2 className="text-lg font-bold text-park-navy mb-4">設定</h2>

          <div className="mb-6 text-sm text-gray-600 space-y-1">
            <p className="font-semibold text-gray-800">PARK Agent</p>
            <p>営業支援AIチャット</p>
            <p className="text-xs text-gray-400">v0.1.0</p>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-3">
            <button
              type="button"
              onClick={handleClear}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
            >
              会話履歴をクリア
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
