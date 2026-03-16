interface NextAction {
  id: string
  icon: string
  label: string
  sub: string
  prompt: string
  urgency: 'high' | 'medium' | 'low'
}

const NEXT_ACTIONS: NextAction[] = [
  {
    id: 'a1',
    icon: '📞',
    label: 'A社フォローアップ',
    sub: '見積提出後 — 反応確認',
    prompt: 'A社への見積フォローアップメールを作成して',
    urgency: 'high',
  },
  {
    id: 'a2',
    icon: '📑',
    label: 'B社デモ資料',
    sub: '来週デモ予定 — 準備開始',
    prompt: 'B社向けデモ資料の構成を提案して',
    urgency: 'medium',
  },
  {
    id: 'a3',
    icon: '🤝',
    label: 'プレスマン次回MTG',
    sub: '方向性合意 — 次ステップ設計',
    prompt: 'プレスマンとの次回MTGアジェンダを作成して',
    urgency: 'medium',
  },
  {
    id: 'a4',
    icon: '📊',
    label: '週次レポート作成',
    sub: '今週の商談進捗まとめ',
    prompt: '今週の商談の進捗をサマリーにして',
    urgency: 'low',
  },
]

const URGENCY_BORDER: Record<string, string> = {
  high: 'border-l-red-400',
  medium: 'border-l-yellow-400',
  low: 'border-l-blue-400',
}

interface NextActionsProps {
  onAction: (prompt: string) => void
}

export default function NextActions({ onAction }: NextActionsProps) {
  return (
    <div className="p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
        <span>💡</span> ネクストアクション
      </h3>
      <div className="space-y-2">
        {NEXT_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.prompt)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 border-l-4 ${URGENCY_BORDER[action.urgency]} bg-white hover:bg-gray-50 hover:shadow-sm transition-all group`}
          >
            <div className="flex items-start gap-2">
              <span className="text-base shrink-0 mt-0.5">{action.icon}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800 group-hover:text-park-navy truncate">
                  {action.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  {action.sub}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
