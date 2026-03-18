// Google Drive integration using Google Identity Services (GIS)
// Browser-only OAuth2 flow — no server needed

interface TokenClientConfig {
  client_id: string
  scope: string
  callback: (response: TokenResponse) => void
}

interface TokenClient {
  requestAccessToken: () => void
}

interface TokenResponse {
  access_token: string
  error?: string
}

interface GISNamespace {
  accounts: {
    oauth2: {
      initTokenClient: (config: TokenClientConfig) => TokenClient
    }
  }
}

let tokenClient: TokenClient | null = null
let accessToken: string | null = null

export function initTokenClient(onSuccess: () => void, onError: (err: string) => void) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const google = (window as unknown as { google?: GISNamespace }).google
  if (!clientId || !google) {
    onError('Google Identity Services が読み込まれていません')
    return
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (response: TokenResponse) => {
      if (response.error) {
        onError(response.error)
        return
      }
      accessToken = response.access_token
      onSuccess()
    },
  })
}

export function requestAccessToken() {
  tokenClient?.requestAccessToken()
}

export function hasAccessToken(): boolean {
  return accessToken !== null
}

async function getOrCreateFolder(name: string, token: string): Promise<string> {
  // Search for existing folder
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const searchData = await searchRes.json()

  if (searchData.files?.length > 0) {
    return searchData.files[0].id
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  const createData = await createRes.json()
  return createData.id
}

export async function saveToGoogleDrive(title: string, markdown: string): Promise<string> {
  if (!accessToken) throw new Error('認証が必要です')

  // Create or find the folder
  const folderId = await getOrCreateFolder('Park-Pitch提案書', accessToken)

  // Create Google Doc via multipart upload
  const metadata = {
    name: title,
    mimeType: 'application/vnd.google-apps.document',
    parents: [folderId],
  }

  const boundary = '---pitch-upload-boundary'
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    markdown,
    `--${boundary}--`,
  ].join('\r\n')

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  )

  if (!res.ok) throw new Error('Google Driveへの保存に失敗しました')

  const data = await res.json()
  return `https://docs.google.com/document/d/${data.id}/edit`
}
