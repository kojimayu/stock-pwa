# Stock-PWA 運用マニュアル

本番環境の日常運用・保守・障害対応の手順書。

---

## 1. システム構成

```
┌─────────────────────────────────────────────────────────┐
│ サーバーPC (Windows)                                     │
│  └─ Next.js アプリ (port 3000)                          │
│     └─ SQLite DB: ./prisma/dev.db                       │
├─────────────────────────────────────────────────────────┤
│ Access DB PC (別PC/同一PC)                               │
│  └─ 物件マスタDB (共有フォルダ経由でアクセス)             │
├─────────────────────────────────────────────────────────┤
│ クライアント端末                                         │
│  └─ タブレット/PC ブラウザ → http://[サーバーIP]:3000    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 日常運用

### 2.1 サーバー起動

```powershell
cd C:\Apps\stock-pwa    # インストール先に変更
npm run start           # 本番モード
# または
npm run dev             # 開発モード（デバッグ時）
```

### 2.2 サーバー停止

ターミナルで `Ctrl + C` を押下。

### 2.3 サーバー状態確認

```powershell
# ポート3000でリッスン中か確認
Get-NetTCPConnection -LocalPort 3000
```

### 2.4 ログ確認

- **コンソール出力**: サーバー起動中のターミナルに表示
- **ブラウザ開発者ツール**: F12 → Console タブ

---

## 3. バックアップ

### 3.1 バックアップ対象

| 対象 | パス | 重要度 |
|------|------|--------|
| SQLite DB | `./prisma/dev.db` | **必須** |
| 環境設定 | `./.env` | 必須 |
| アップロード画像 | `./public/uploads/` | 任意 |

### 3.2 自動バックアップ設定

タスクスケジューラでPowerShellスクリプトを毎日実行。

**スクリプト例 (`scripts/backup_db.ps1`):**

```powershell
$ProjectRoot = "C:\Apps\stock-pwa"
# SharePoint同期フォルダ (pluscompany,)
$BackupFolder = "C:\Users\Kojima\pluscompany,\pluscompany, - ドキュメント\General\Dev\stock-pwa\バックアップ\db"
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = "$BackupFolder\dev_$Date.db"

# バックアップフォルダ作成
if (!(Test-Path $BackupFolder)) {
    New-Item -ItemType Directory -Path $BackupFolder
}

# コピー
Copy-Item "$ProjectRoot\prisma\dev.db" $BackupFile

# 古いバックアップ削除（30日以上）
Get-ChildItem $BackupFolder -Filter "*.db" | 
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | 
    Remove-Item

Write-Host "バックアップ完了: $BackupFile"
```

**タスクスケジューラ設定:**
→ 詳細は [backup_setup_guide.md](./backup_setup_guide.md) を参照

### 3.3 手動バックアップ

```powershell
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item ".\prisma\dev.db" ".\prisma\backup_$Date.db"
```

### 3.4 復元手順

```powershell
# 1. サーバー停止
# 2. 現在のDBをリネーム（念のため保持）
Rename-Item ".\prisma\dev.db" ".\prisma\dev_old.db"

# 3. バックアップから復元
Copy-Item "C:\Backup\dev_20260203.db" ".\prisma\dev.db"

# 4. サーバー再起動
npm run start
```

---

## 4. 障害対応

### 4.1 サーバーが起動しない

```powershell
# ポート競合確認
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
# PIDが表示されたら、そのプロセスを停止
Stop-Process -Id [PID]

# 再起動
npm run start
```

### 4.2 DBエラー (SQLITE_LOCKED / SQLITE_BUSY)

DBファイルがロックされている場合:

```powershell
# サーバー停止 → 再起動
# または、ロックしているプロセスを特定して停止
handle.exe prisma\dev.db   # Sysinternals Handle ツール使用
```

### 4.3 Access DBに接続できない

```powershell
# ネットワークパス確認
Test-Path $env:ACCESS_DB_PATH

# 共有フォルダへのアクセス確認
net use
```

### 4.4 タブレットから接続できない

1. **ファイアウォール確認**
   ```powershell
   New-NetFirewallRule -DisplayName "Stock-PWA" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   ```

2. **IPアドレス確認**
   ```powershell
   ipconfig | Select-String "IPv4"
   ```

### 4.5 タブレット画面の更新（Fully Kiosk Browser）

変更が反映されない場合:
1. **3本指タップ**でFully Kioskメニューを開く
2. **「Go to Start URL」** を選択
3. アプリが最初から再読み込みされる

---

## 5. メンテナンス

### 5.1 依存パッケージ更新

```powershell
npm update
npm audit fix
```

### 5.2 Prisma DB マイグレーション

スキーマ変更があった場合:

```powershell
npx prisma migrate deploy   # 本番環境
npx prisma generate         # クライアント再生成
```

### 5.3 Next.js キャッシュクリア

```powershell
Remove-Item -Recurse -Force .next
npm run build
```

### 5.4 データベース最適化

```powershell
# SQLite VACUUM（ファイルサイズ削減）
sqlite3 prisma\dev.db "VACUUM;"
```

---

## 6. セキュリティ

### 6.1 アクセス制御

- サーバーはローカルネットワーク内のみでアクセス可能（デフォルト）
- 外部公開する場合は HTTPS + 認証を必須とする

### 6.2 認証情報

| 項目 | 場所 |
|------|------|
| 業者PIN | DB内 `Vendor.pin` |
| 管理者パスワード | DB内 `Admin` テーブル（将来実装）|

### 6.3 .envファイル

`.env` にはセンシティブな情報が含まれるため:
- Git管理対象外（.gitignoreに記載）
- 読み取り権限を制限

---

## 7. 定期作業チェックリスト

### 毎日
- [ ] バックアップが正常に作成されているか確認

### 毎週
- [ ] サーバーログにエラーがないか確認
- [ ] ディスク空き容量確認 (10GB以上推奨)

### 毎月
- [ ] 古いバックアップの削除確認
- [ ] セキュリティアップデート確認 (`npm audit`)

### 年次
- [ ] サーバーOS/Node.jsのアップデート検討
- [ ] データベース最適化 (VACUUM)

---

## 8. 連絡先・エスカレーション

| 状況 | 対応 |
|------|------|
| 軽微な不具合 | 本マニュアルで対応 |
| 復旧不能な障害 | 開発担当へ連絡 |
| データ消失 | バックアップから復元 → 開発担当へ報告 |

---

## 関連ドキュメント

- [バックアップ自動化設定](./backup_setup_guide.md)
- [サーバー移行ガイド](./migration_guide.md)
