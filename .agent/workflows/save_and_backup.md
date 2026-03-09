---
description: プロジェクトの状態を完全に保存する（テスト実行 + DBバックアップ + Gitコミット）
---

# 保存とバックアップの実行

ユーザーが「保存して」と指示した際に実行するフローです。

> ⚠️ **重要: Git操作の前に必ずdev確認を行うこと**
> コード変更後は、`npm run dev` でdevサーバーを起動し、ユーザーに画面確認してもらってから下記フローに進むこと。
> 本番サーバー（port 3000）が起動中の場合は別ポート（例: `-p 3001`）で起動する。

> 🚨 **絶対禁止: 本番サーバー稼働中の `npm run build` 実行**
> `npm run start` が起動中の状態で `npm run build` を実行すると、`.next/` が上書きされ、稼動中のサーバーがエラーになる。
> **必ず「停止 → ビルド → 起動」の順序を守ること。**
> 運用に影響する作業（ビルド・サーバー停止・マイグレーション等）は、必ずユーザーの承認を得てから実行すること。

0. **dev確認（必須）**
   変更した画面をdevサーバーで確認してもらいます。
   ユーザーの承認を得てからテスト＋コミットに進んでください。
   ```powershell
   npx next dev -H 0.0.0.0 -p 3001 --webpack
   ```
1. **テストの実行（コミット前チェック）**
   コミット前に単体テストを実行し、既存機能が壊れていないか確認します。
   テストが失敗した場合は、**コミットを中止**し、ユーザーに修正を提案してください。
   // turbo
   ```powershell
   $env:DATABASE_URL="file:./prisma/test-vitest.db"; $env:NEXTAUTH_SECRET="test-secret"; $env:NEXTAUTH_URL="http://localhost:3000"; npx vitest run
   ```

2. **⚠️ 環境変数リセット（必須）**
   テスト実行後は `$env:DATABASE_URL` がテストDBを指しているため、**必ずリセットする**。
   リセットしないと後続の全コマンドがテストDBに接続してしまう。
   // turbo
   ```powershell
   Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:NEXTAUTH_SECRET -ErrorAction SilentlyContinue; Remove-Item Env:NEXTAUTH_URL -ErrorAction SilentlyContinue; Write-Host "Environment variables reset OK"
   ```

3. **バックアップスクリプトの実行**
   テストが全通過した場合のみ、データベースと環境変数をバックアップします。
   // turbo
   ```powershell
   .\scripts\backup_db.ps1 -BackupFolder .\backups
   ```

4. **Gitへのコミット**
   変更をステージングし、コミットします。
   ※コミットメッセージは、直前の作業内容に基づいて適切なものを生成してください。（例: "feat: [機能名]" / "fix: [修正内容]"）
   ```powershell
   git add .
   git commit -m "chore: Save point (Manual backup)"
   ```

## テスト失敗時の対応
- テストが失敗した場合、エラー内容をユーザーに報告してください。
- 軽微な修正で対応できる場合は修正を提案してください。
- 新機能追加によりテストが古くなった場合は、テストの更新を提案してください。
- **前回の変更と無関係のテスト失敗でも、原因を調査して報告すること。** 「無関係だからスキップ」は禁止。

## 運用中の安全ルール

> 🚨 **絶対遵守**

1. **本番サーバー稼働中に `npm run build` を実行しない**
   - `.next/` が上書きされ、稼働中のサーバーがエラーになる
   - 必ず「停止 → ビルド → 起動」の順序を守る

2. **運用に影響する作業は必ずユーザー承認を得てから実行**
   - 対象: ビルド、サーバー停止/起動、マイグレーション、スキーマ変更
   - 「これからビルドします。サーバーを停止してください」のように報告すること
