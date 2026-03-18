# Pitch - 提案書ジェネレーター

自社サービス特化の提案書AI自動生成ツール。PDFからサービス情報を構造化抽出し、ヒアリング情報と組み合わせて提案書をワンクリック生成。

## 構成

- **フロント**: Vite + React + TypeScript + Tailwind + React Router
- **バックエンド**: Express + Gemini API
- **データ**: JSON永続化（server/data/）

## セットアップ

```bash
npm install
cp .env.example .env
# .env に GEMINI_API_KEY を設定
npm run dev
```

- フロント: http://localhost:5179
- API: http://localhost:3002

## 画面構成

| 画面 | パス | 概要 |
|---|---|---|
| 会社プロフィール | `/settings` | 初回オンボーディング＋会社情報編集 |
| サービス管理 | `/services` | PDF登録→AI構造化抽出→編集 |
| 提案書作成 | `/generate` | 提案先＋サービス選択＋ヒアリング→生成 |
| 提案書履歴 | `/proposals` | 過去の提案書一覧・プレビュー・印刷 |

## API

| Method | Path | 用途 |
|---|---|---|
| GET/POST | `/api/company` | 会社プロフィール |
| GET/POST/PUT/DELETE | `/api/services` | サービスCRUD |
| POST | `/api/generate` | 提案書生成 |
| GET | `/api/proposals` | 提案書履歴 |
