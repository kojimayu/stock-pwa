---
description: ブラウザテスト用に本番DBをコピーしたテスト環境でdevサーバーを起動する
---

# ブラウザテスト（本番DB非破壊）

本番DBを汚さずにブラウザでE2Eテストを行うためのワークフローです。

## 手順

// turbo-all

1. **本番DBをコピー**
   ```powershell
   Copy-Item dev.db dev-browser-test.db -Force
   ```

2. **テスト用devサーバーを起動（別ポート）**
   ```powershell
   $env:DATABASE_URL = "file:F:/Antigravity/stock-pwa/dev-browser-test.db"; npx next dev -H 0.0.0.0 -p 3001 --webpack
   ```

3. **テスト用データを自由に作成・操作**
   - テスト業者・担当者の追加、商品在庫の変更など自由に実施
   - 本番DBには一切影響しない

4. **テスト完了後: テストDBを削除**
   ```powershell
   Remove-Item dev-browser-test.db -Force -ErrorAction SilentlyContinue
   ```

5. **環境変数リセット**
   ```powershell
   Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Write-Host "Reset OK"
   ```

## 注意事項
- 本番サーバー（port 3000）が起動中でも、port 3001 で干渉なく実行可能
- テストDBは `.gitignore` に `dev-browser-test.db` を追加して管理外にすること
