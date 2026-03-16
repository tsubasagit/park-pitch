export interface FavoriteCompany {
  id: string
  name: string
  prompt: string // クリック時に入力欄にセットする文言
}

export interface RecentMinutes {
  id: string
  date: string
  title: string
  summary: string // クリック時に会話に出す要約
  dealId?: string // 紐付く案件ID
}

export type DealStatus = '初回接触' | '提案中' | '見積提出' | '導入進行中' | '受注' | '失注'

export interface Deal {
  id: string
  company: string
  title: string
  status: DealStatus
  prompt: string // クリック時に入力欄にセットする文言
  minuteIds: string[] // 紐付く議事録ID
}

const STATUS_ICON: Record<DealStatus, string> = {
  '初回接触': '🔵',
  '提案中': '🟡',
  '見積提出': '🟠',
  '導入進行中': '🟢',
  '受注': '✅',
  '失注': '⛔',
}

export function dealStatusIcon(status: DealStatus): string {
  return STATUS_ICON[status]
}

export const favoriteCompanies: FavoriteCompany[] = [
  { id: '1', name: 'A社', prompt: 'A社の最新状況は？' },
  { id: '2', name: 'C社', prompt: 'C社の商談状況を教えて' },
  { id: '3', name: 'E社', prompt: 'E社の直近の動きは？' },
]

export const recentMinutesList: RecentMinutes[] = [
  {
    id: 'm1',
    date: '3/12',
    title: 'プレスマン',
    summary:
      'プレスマンMTG：PARK Agent の方向性で合意。新規1画面でチャット型UI、左サイドにお気に入り・最近の議事録。Gemini API で進める。',
    dealId: 'd3',
  },
  {
    id: 'm2',
    date: '3/7',
    title: 'A社 商談',
    summary:
      'A社（3/7）商談要点：コスト現行比30%削減希望、導入時期6月までに決定希望、懸念は既存システムとの連携。次回は見積提出。',
    dealId: 'd1',
  },
  {
    id: 'm3',
    date: '3/5',
    title: 'B社 定例',
    summary: 'B社定例：進捗確認。Phase1 は予定通り。来週デモ希望。',
    dealId: 'd2',
  },
]

export const deals: Deal[] = [
  {
    id: 'd1',
    company: 'A社',
    title: 'コスト削減プロジェクト',
    status: '見積提出',
    prompt: 'A社「コスト削減プロジェクト」の状況を教えて',
    minuteIds: ['m2'],
  },
  {
    id: 'd2',
    company: 'B社',
    title: 'Phase1 導入',
    status: '導入進行中',
    prompt: 'B社「Phase1 導入」の進捗を教えて',
    minuteIds: ['m3'],
  },
  {
    id: 'd3',
    company: 'プレスマン',
    title: 'PARK Agent 共同開発',
    status: '提案中',
    prompt: 'プレスマン「PARK Agent 共同開発」の状況を教えて',
    minuteIds: ['m1'],
  },
]
