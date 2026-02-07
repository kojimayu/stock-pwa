---
description: プロジェクトの状態を完全に保存する（DBバックアップ + Gitコミット）
---

# 保存とバックアップの実行

ユーザーが「保存して」と指示した際に実行するフローです。

1. **バックアップスクリプトの実行**
   プロジェクトのルートディレクトリで以下のコマンドを実行し、データベースと環境変数をバックアップします。
   // turbo
   ```powershell
   .\scripts\backup_db.ps1 -BackupFolder .\backups
   ```

2. **Gitへのコミット**
   変更をステージングし、コミットします。
   ※コミットメッセージは、直前の作業内容に基づいて適切なものを生成してください。（例: "chore: Save point - [作業内容]"）
   ```powershell
   git add .
   git commit -m "chore: Save point (Manual backup)"
   ```
