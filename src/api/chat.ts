const API_BASE = '/api'

export async function sendChatMessage(
  userMessage: string,
  contextSummary?: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      contextSummary,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || '応答の取得に失敗しました')
  }
  const data = (await res.json()) as { reply: string }
  return data.reply
}
