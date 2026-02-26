# ⚠️ データベース操作 安全ガイドライン

> **このファイルはデータベースを操作する前に必ず確認すること**

---

## 🚨 絶対にやってはいけないこと

| 禁止事項 | 理由 |
|---------|------|
| `prisma db push --accept-data-loss` | **全データが消失する可能性がある** |
| `prisma migrate reset` | データベースを完全にリセットする |
| `taskkill /F /IM node.exe` | 関係のないNode.jsプロセスまで終了させる |
| バックアップなしでの `dev.db` 直接操作 | 復元不可能になる |
| `DROP TABLE` / `DELETE FROM` の直接実行 | データ消失 |
| テスト後に `$env:DATABASE_URL` を未確認のまま操作 | テストDBと本番DBを取り違える |

---

## ✅ データベース操作の手順（チェックリスト）

### スキーマ変更時（カラム追加など）

0. **[ ] 環境変数の確認（最重要）**
   ```powershell
   echo $env:DATABASE_URL
   # 期待値: 空 または "file:F:/Antigravity/stock-pwa/dev.db"
   # NG値: "file:./prisma/test-vitest.db" → テスト用！
   ```
   テスト実行後は `$env:DATABASE_URL` がテストDBを指している場合がある。
   **必ずリセットするか、新しいターミナルで作業すること。**
   ```powershell
   Remove-Item Env:DATABASE_URL  # リセット
   ```

1. **[ ] バックアップ取得**（2箇所以上）
   ```powershell
   Copy-Item dev.db "backups/dev_before_migration_$(Get-Date -Format yyyyMMdd_HHmmss).db"
   Copy-Item dev.db "C:\Users\Kojima\Desktop\dev_backup.db"
   ```

2. **[ ] バックアップのデータ確認**
   ```powershell
   node check_db.mjs  # AdminUser, Vendor, Product等の件数確認
   ```

3. **[ ] `prisma db push`（`--accept-data-loss` フラグ禁止）**
   ```powershell
   npx prisma db push
   ```
   - ⚠️ 「Some data may be lost」の警告が出たら **中止** してユーザーに報告

4. **[ ] 復元後のデータ確認**
   ```powershell
   node check_db.mjs
   ```

---

### プロセス終了時

**絶対に `taskkill /IM node.exe` を使わないこと。**

代わりに以下の方法を使う:

```powershell
# 方法1: ポート指定で特定プロセスのみ終了
$pid = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
if ($pid) { Stop-Process -Id $pid -Force }

# 方法2: Antigravityのsend_command_inputツールでTerminate=trueを使う
```

---

## 📋 データ確認スクリプト (check_db.mjs)

```javascript
// f:\Antigravity\stock-pwa\check_db.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const users = await prisma.adminUser.findMany({ select: { id: true, email: true, name: true } });
console.log('AdminUser:', JSON.stringify(users, null, 2));
console.log('Vendor count:', await prisma.vendor.count());
console.log('Product count:', await prisma.product.count());
console.log('AirconProduct count:', await prisma.airconProduct.count());
await prisma.$disconnect();
```

---

## 🔄 復元手順

### ローカルバックアップから
```powershell
Copy-Item ".\backups\dev_YYYYMMDD_HHMMSS.db" "dev.db" -Force
npx prisma db push --skip-generate  # スキーマ同期（データ保持）
node check_db.mjs                   # データ確認
```

### 定期バックアップ（23時）から
```powershell
Copy-Item "C:\Users\Kojima\pluscompany,\pluscompany, - ドキュメント\General\Dev\stock-pwa\バックアップ\db\dev_YYYYMMDD_HHMMSS.db" "dev.db" -Force
npx prisma db push --skip-generate
node check_db.mjs
```

---

## 📝 インシデント履歴

| 日時 | 原因 | 影響 | 復元方法 |
|------|------|------|---------|
| 2026-02-26 | テスト後の `$env:DATABASE_URL` 汚染 | テストDBに接続し「データ消失」と誤診（dev.dbは無事） | 23時バックアップから復元（結果的に不要） |

> **教訓**: `vitest run` は `$env:DATABASE_URL` を `test-vitest.db` に設定する。同じターミナルで本番操作するとテストDBに接続してしまう。**テスト後は必ず `Remove-Item Env:DATABASE_URL` でリセットすること。**

---

## 💡 備考: ファイル名について

- `dev.db` = **本番データベース**（名前は紛らわしいが運用中のため変更注意）
- `prisma/test-vitest.db` = テスト専用DB（テスト時に自動作成・クリーンアップ）
- `.env` の `DATABASE_URL` = `file:F:/Antigravity/stock-pwa/dev.db`（本番を指す）

