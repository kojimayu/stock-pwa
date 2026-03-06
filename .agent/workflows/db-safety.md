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

0. **環境変数の確認（最重要・必ず最初に実行）**
   テスト実行後は `$env:DATABASE_URL` がテストDBを指している場合がある。
   必ず確認してからDB操作を行う。
   // turbo
   ```powershell
   if ($env:DATABASE_URL -and $env:DATABASE_URL -notlike '*dev.db*') { Write-Host "WARNING: DATABASE_URL=$env:DATABASE_URL (テストDB！リセットします)"; Remove-Item Env:DATABASE_URL } else { Write-Host "OK: DATABASE_URL is correct or unset (will use .env)" }
   ```

1. **バックアップ取得（3ファイルセット × 2箇所）**
   SQLite WALモードでは `.db` `.db-wal` `.db-shm` の3ファイルがセット。
   **`.db` のみのコピーはチェックポイント時点の古いデータしか含まない不完全バックアップになる。**
   // turbo
   ```powershell
   $ts = Get-Date -Format yyyyMMdd_HHmmss; $src = "F:\Antigravity\stock-pwa\dev.db"; $dst1 = "F:\Antigravity\stock-pwa\backups\dev_before_schema_$ts"; $dst2 = "C:\Users\Kojima\Desktop\dev_backup_$ts"; foreach($dst in @($dst1,$dst2)) { Copy-Item $src "$dst.db" -Force; if(Test-Path "$src-wal"){Copy-Item "$src-wal" "$dst.db-wal" -Force}; if(Test-Path "$src-shm"){Copy-Item "$src-shm" "$dst.db-shm" -Force} }; Write-Host "Backup created (3-file set) in 2 locations"
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
