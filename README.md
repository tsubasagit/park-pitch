# PARK Agent

営業特化・日本語チャット1画面のプロトタイプ。議事録が裏に溜まり、聞けば答え、頼めば作る。

## 構成

- **フロント**: Vite + React + TypeScript + Tailwind（Navy / Orange）
- **バックエンド**: Express + Gemini API（`/api/chat`）
- **データ**: 議事録モック（プレスマンMTG + A社/B社）をサーバーが参照して応答

## セットアップ

```bash
npm install
cp .env.example .env
# .env に GEMINI_API_KEY を設定
npm run dev
```

- フロント: http://localhost:5179
- API: http://localhost:3002

## 機能

- ヘッダー（PARK ロゴ・営業AI・設定）
- 左サイド: お気に入り会社（クリックで入力欄に文言セット）、最近の議事録（クリックで要約を会話に追加）
- チャット: ウェルカム、サジェストチップ、メッセージ履歴、入力欄
- モバイル: サイドはハンバーガーボタンで開閉

## GitHub Pages で公開

**注意**: GitHub Pages は静的サイトのみ。チャットの AI 応答（API）は動きません。UI のデモとして公開されます。

```bash
npm install
npm run deploy
```

1. GitHub でリポジトリ `park_agent` を新規作成（空のまま）
2. ローカルで `git remote add origin https://github.com/<ユーザー名>/park_agent.git` を実行済みの状態で `npm run deploy` を実行すると、`gh-pages` ブランチにビルド成果物が push され、GitHub の Settings → Pages で「gh-pages ブランチ」を選ぶと `https://<ユーザー名>.github.io/park_agent/` で公開されます。

リポジトリ名を変えた場合は `package.json` の `build:gh` の `--base /park_agent/` を `/あなたのリポジトリ名/` に合わせて変更してください。
