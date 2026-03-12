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
  },
  {
    id: 'm2',
    date: '3/7',
    title: 'A社 商談',
    summary:
      'A社（3/7）商談要点：コスト現行比30%削減希望、導入時期6月までに決定希望、懸念は既存システムとの連携。次回は見積提出。',
  },
  {
    id: 'm3',
    date: '3/5',
    title: 'B社 定例',
    summary: 'B社定例：進捗確認。Phase1 は予定通り。来週デモ希望。',
  },
]
