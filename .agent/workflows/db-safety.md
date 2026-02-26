---
description: データベース操作前に必ず実行する安全チェック（スキーマ変更・マイグレーション時）
---

# データベース操作の安全手順

> ⚠️ **このワークフローは `prisma db push`, `prisma migrate`, スキーマ変更時に必ず実行すること**

## 禁止事項（絶対厳守）

- `prisma db push --accept-data-loss` → **使用禁止** (全データ消失の危険)
- `prisma migrate reset` → **使用禁止**
- `taskkill /F /IM node.exe` → **使用禁止** (他プロセスを巻き添えにする)
- `DROP TABLE` / `DELETE FROM` → バックアップなしでは**使用禁止**

## 手順

1. **バックアップ取得（2箇所）**
   ローカルbackupsフォルダとデスクトップの2箇所にバックアップを作成する。
   // turbo
   ```powershell
   Copy-Item "F:\Antigravity\stock-pwa\dev.db" "F:\Antigravity\stock-pwa\backups\dev_before_schema_$(Get-Date -Format yyyyMMdd_HHmmss).db" -Force; Copy-Item "F:\Antigravity\stock-pwa\dev.db" "C:\Users\Kojima\Desktop\dev_backup_$(Get-Date -Format yyyyMMdd_HHmmss).db" -Force; Write-Host "Backup created in 2 locations"
   ```

2. **バックアップのデータ件数を確認**
   // turbo
   ```powershell
   node F:\Antigravity\stock-pwa\check_db.mjs
   ```
   AdminUser, Vendor, Product, AirconProduct の件数が0でないことを確認。
   **もし0件なら中止してユーザーに報告すること。**

3. **スキーマ変更を適用（--accept-data-loss フラグ禁止）**
   ```powershell
   npx prisma db push
   ```
   - ⚠️「Some data may be lost」の警告が出たら → **即座に中止**してユーザーに報告
   - ⚠️ この手順のみ `turbo` 指定なし（ユーザー承認必須）

4. **適用後のデータ件数を確認**
   // turbo
   ```powershell
   node F:\Antigravity\stock-pwa\check_db.mjs
   ```
   手順2の件数と一致することを確認。不一致ならバックアップから復元。

5. **Prisma Client再生成**
   // turbo
   ```powershell
   npx prisma generate
   ```

## Next.js dev serverの停止方法

`taskkill /IM node.exe` は**絶対に使わないこと**。代わりに以下を使う:

```powershell
# ポート3000のプロセスのみ停止
$p = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($p) { Stop-Process -Id $p -Force; Write-Host "Stopped PID: $p" } else { Write-Host "No process on port 3000" }
```

## 復元手順（データ消失時）

```powershell
# ローカルバックアップから
Copy-Item ".\backups\dev_before_schema_XXXXXXXX.db" "dev.db" -Force

# 定期バックアップ（23時）から
Copy-Item "C:\Users\Kojima\pluscompany,\pluscompany, - ドキュメント\General\Dev\stock-pwa\バックアップ\db\dev_YYYYMMDD_HHMMSS.db" "dev.db" -Force

# スキーマ同期 + 確認
npx prisma db push --skip-generate
node check_db.mjs
```
