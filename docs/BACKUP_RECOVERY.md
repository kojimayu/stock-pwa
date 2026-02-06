# バックアップと復旧ガイド

## 概要

このシステムはSQLiteデータベース（`prisma/dev.db`）にすべてのデータを保存しています。
バックアップと復旧の手順を理解しておくことで、システム障害時に迅速に対応できます。

---

## 1. バックアップ対象

| ファイル | 場所 | 内容 |
|---------|------|------|
| `dev.db` | `prisma/dev.db` | 商品、業者、取引履歴、在庫など全データ |
| `.env` | プロジェクトルート | 環境設定（Azure認証情報など） |

---

## 2. 手動バックアップ

### すぐにバックアップを取る

```powershell
# PowerShellで実行
cd F:\Antigravity\stock-pwa
Copy-Item prisma/dev.db -Destination "C:\バックアップ\dev_$(Get-Date -Format 'yyyyMMdd_HHmmss').db"
```

### OneDrive/SharePointへバックアップ

```powershell
# スクリプトを直接実行
powershell -ExecutionPolicy Bypass -File scripts/backup_db.ps1
```

---

## 3. 自動バックアップ（タスクスケジューラ）

詳細手順は `backup_setup_guide.md` を参照。

**推奨設定:**
- 毎日 23:00 に自動バックアップ
- OneDrive/SharePointに保存（クラウド同期）
- 7日分のバックアップを保持

---

## 4. 復旧手順

### ケース1: データベースが破損した場合

```powershell
# 1. 開発サーバーを停止
# Ctrl+C で npm run dev を停止

# 2. 破損したDBをバックアップ（念のため）
Move-Item prisma/dev.db prisma/dev_corrupted_$(Get-Date -Format 'yyyyMMdd').db

# 3. 最新のバックアップをコピー
Copy-Item "C:\バックアップ\dev_20260205_230000.db" prisma/dev.db

# 4. 開発サーバーを再起動
npm run dev
```

### ケース2: 誤ってデータを削除した場合

1. 開発サーバーを停止
2. 削除前のバックアップファイルを探す
3. 上記と同様の手順で復元

### ケース3: システム全体を新しいPCに移行する場合

```powershell
# 旧PCから以下をコピー
# - F:\Antigravity\stock-pwa フォルダ全体
# または
# - prisma/dev.db（データベース）
# - .env（環境設定）

# 新PCで
cd F:\Antigravity\stock-pwa
npm install
npx prisma generate
npm run dev
```

---

## 5. バックアップの確認

### バックアップが正常かテスト

```powershell
# バックアップファイルをテスト用にコピー
Copy-Item "C:\バックアップ\dev_最新.db" prisma/test_restore.db

# SQLiteで開けるか確認
sqlite3 prisma/test_restore.db ".tables"
```

正常なら以下のテーブルが表示されます:
```
InventoryCount  Order           Product         Vendor
InventoryCountItem  OperationLog  Transaction    ...
```

---

## 6. 緊急連絡先

システムに問題が発生した場合:
1. まず開発サーバーを停止
2. 最新のバックアップを確認
3. 必要に応じて復旧手順を実行

---

## 7. 定期確認チェックリスト

- [ ] 週1回: バックアップファイルが作成されているか確認
- [ ] 月1回: 復旧テストを実施（テスト用DBで確認）
- [ ] 四半期: バックアップ先の空き容量確認

