# プロジェクト固有ルール (stock-pwa)

## データベース操作

### マイグレーション実行時の安全確認
`prisma migrate dev` や `prisma migrate deploy` を実行する前に、**必ず以下を行うこと**：

1. `npm run start` や `npm run dev` が動いていないか確認する
2. 動いている場合は、**ユーザーに停止の承認を取ってから**停止する
3. マイグレーション完了後に、ユーザーにサーバー再起動を案内する

> **理由:** マイグレーション中にDBロックが発生し、同時にアクセスしているサーバーが固まる事故が発生したため（2026-02-21）。

### DATABASE_URLの確認
マイグレーション実行時は `DATABASE_URL` が本番DB（`file:./prisma/dev.db`）を指していることを必ず確認する。
テスト用DB（`file:./prisma/test-vitest.db`）に対してマイグレーションを実行しないこと。

## ドキュメント更新

### SYSTEM_UPDATES（ユーザー向け変更履歴）
機能追加・不具合修正・UI変更があった場合、`views/dashboard.py` の `SYSTEM_UPDATES` リストにエントリを追加すること。
※ 本プロジェクトはNext.js（TSX）のため、該当する対応箇所がある場合のみ。

### テストとドキュメントの同時更新
機能の変更や追加を行った場合は、対応するテストも変更・追加し、以下のドキュメントも更新すること：
- `docs/TESTING.md` — テスト一覧
- `docs/CHANGELOG.md` — 変更履歴
- `docs/FEEDBACK.md` — 対応済み項目の移動
