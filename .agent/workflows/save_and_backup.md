---
description: プロジェクトの状態を完全に保存する（テスト実行 + DBバックアップ + Gitコミット）
---

# 保存とバックアップの実行

ユーザーが「保存して」と指示した際に実行するフローです。

1. **テストの実行（コミット前チェック）**
   コミット前に単体テストを実行し、既存機能が壊れていないか確認します。
   テストが失敗した場合は、**コミットを中止**し、ユーザーに修正を提案してください。
   // turbo
   ```powershell
   $env:DATABASE_URL="file:./prisma/test-vitest.db"; $env:NEXTAUTH_SECRET="test-secret"; $env:NEXTAUTH_URL="http://localhost:3000"; npx vitest run
   ```

2. **バックアップスクリプトの実行**
   テストが全通過した場合のみ、データベースと環境変数をバックアップします。
   // turbo
   ```powershell
   .\scripts\backup_db.ps1 -BackupFolder .\backups
   ```

3. **Gitへのコミット**
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
