import { deals, recentMinutesList, favoriteCompanies, dealStatusIcon, type Deal, type RecentMinutes } from '../data/mock'

export interface CommandResult {
  type: 'navigate' | 'passthrough'
  content?: string
  label?: string
}

function findDealByCompany(input: string): Deal | undefined {
  return deals.find((d) => input.includes(d.company))
}

function findMinutesByDate(input: string): RecentMinutes | undefined {
  const dateMatch = input.match(/(\d{1,2})\/(\d{1,2})/)
  if (!dateMatch) return undefined
  const dateStr = `${dateMatch[1]}/${dateMatch[2]}`
  return recentMinutesList.find((m) => m.date === dateStr)
}

function formatDealDetail(deal: Deal): string {
  const icon = dealStatusIcon(deal.status)
  const relatedMinutes = recentMinutesList.filter((m) => deal.minuteIds.includes(m.id))
  const minutesSection = relatedMinutes.length > 0
    ? relatedMinutes.map((m) => `- **${m.date} ${m.title}**: ${m.summary}`).join('\n')
    : '_関連議事録なし_'

  return `## ${icon} ${deal.company} — ${deal.title}

**ステータス**: ${deal.status}

### 関連議事録
${minutesSection}`
}

function formatMinutesDetail(minutes: RecentMinutes): string {
  return `## 📝 ${minutes.date} ${minutes.title}

${minutes.summary}`
}

function formatDealList(): string {
  const rows = deals.map((d) => {
    const icon = dealStatusIcon(d.status)
    return `| ${icon} ${d.company} | ${d.title} | ${d.status} |`
  })

  return `## 📋 案件一覧

| 企業 | 案件名 | ステータス |
|---|---|---|
${rows.join('\n')}

---
_企業名を入力すると詳細を表示します。_`
}

/** 会社一覧: お気に入り + 案件から企業名を重複排除しMarkdown表で返す */
function formatCompanyList(): string {
  const companyMap = new Map<string, { dealCount: number; isFavorite: boolean }>()

  for (const d of deals) {
    const existing = companyMap.get(d.company) ?? { dealCount: 0, isFavorite: false }
    existing.dealCount += 1
    companyMap.set(d.company, existing)
  }

  for (const fav of favoriteCompanies) {
    const existing = companyMap.get(fav.name) ?? { dealCount: 0, isFavorite: false }
    existing.isFavorite = true
    companyMap.set(fav.name, existing)
  }

  if (companyMap.size === 0) return '会社データがありません。'

  const rows = Array.from(companyMap.entries()).map(([name, info]) => {
    const star = info.isFavorite ? ' ⭐' : ''
    return `| ${name}${star} | ${info.dealCount}件 |`
  })

  return `## 🏢 会社一覧

| 会社名 | 案件数 |
|--------|--------|
${rows.join('\n')}

---
_⭐ = お気に入り。企業名を入力すると案件詳細を表示します。_`
}

/** 議事録一覧: 全件をMarkdown表で返す */
function formatMinutesList(): string {
  if (recentMinutesList.length === 0) return '議事録データがありません。'

  const rows = recentMinutesList.map((m) => {
    const deal = deals.find((d) => d.minuteIds.includes(m.id))
    const company = deal?.company ?? ''
    return `| ${m.date} | ${company} | ${m.title} | ${m.summary.slice(0, 40)}… |`
  })

  return `## 📝 議事録一覧

| 日付 | 会社 | タイトル | 要約 |
|------|------|----------|------|
${rows.join('\n')}`
}

export function parseCommand(input: string): CommandResult {
  const trimmed = input.trim()

  // 案件一覧
  if (/^案件(一覧|リスト)?$/.test(trimmed) || /^(すべての|全)?案件(を)?(見せて|表示|教えて|確認)/.test(trimmed)) {
    return { type: 'navigate', content: formatDealList(), label: trimmed }
  }

  // 会社一覧
  if (/^会社(一覧|リスト)?$/.test(trimmed) || /^(すべての|全)?会社(を)?(見せて|表示|教えて|確認)/.test(trimmed)) {
    return { type: 'navigate', content: formatCompanyList(), label: trimmed }
  }

  // 議事録一覧
  if (/^議事録(一覧|リスト)?$/.test(trimmed) || /^(すべての|全)?議事録(を)?(見せて|表示|教えて|確認)/.test(trimmed)) {
    return { type: 'navigate', content: formatMinutesList(), label: trimmed }
  }

  // 議事録 + 日付
  if (/議事録/.test(trimmed) || /^(\d{1,2})\/(\d{1,2})$/.test(trimmed)) {
    const minutes = findMinutesByDate(trimmed)
    if (minutes) {
      return { type: 'navigate', content: formatMinutesDetail(minutes), label: trimmed }
    }
  }

  // 「○○を開いて」「○○の状況」「○○」→ 企業名マッチ
  if (/を(開いて|見せて|表示)/.test(trimmed) || /の(状況|詳細|情報)/.test(trimmed)) {
    const deal = findDealByCompany(trimmed)
    if (deal) {
      return { type: 'navigate', content: formatDealDetail(deal), label: trimmed }
    }
  }

  // 企業名のみ入力（短い入力で企業名にマッチ）
  if (trimmed.length <= 10) {
    const deal = findDealByCompany(trimmed)
    if (deal && trimmed.includes(deal.company)) {
      return { type: 'navigate', content: formatDealDetail(deal), label: trimmed }
    }
  }

  return { type: 'passthrough' }
}
