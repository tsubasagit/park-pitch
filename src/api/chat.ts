const API_BASE = '/api'

export async function sendChatMessage(
  userMessage: string,
  files?: File[],
): Promise<string> {
  const form = new FormData()
  form.append('message', userMessage)
  if (files?.length) {
    files.forEach((f) => form.append('files', f))
  }

  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || '応答の取得に失敗しました')
  }
  const data = (await res.json()) as { reply: string }
  return data.reply
}
