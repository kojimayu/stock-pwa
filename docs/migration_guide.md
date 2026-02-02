# サーバーPC移行ガイド

開発PC → 本番サーバーPCへの移行手順。

---

## 前提構成

```
【開発環境（現在）】
┌─────────────────┐
│  開発PC         │ ← すべてここに集約
│  - Node.js      │
│  - SQLite DB    │
│  - Access DB    │
└─────────────────┘

【本番環境（移行後）】
┌─────────────────┐         ┌─────────────────┐
│  サーバーPC      │ ──────► │  Access DB PC   │
│  - Node.js      │ ネットワーク │  - Access DB    │
│  - SQLite DB    │  共有     │                 │
└─────────────────┘         └─────────────────┘
        │
        │ Wi-Fi
        ▼
┌─────────────────┐
│  タブレット      │
│  Fully Kiosk    │
└─────────────────┘
```

---

## Step 1: サーバーPCの準備

### 1.1 Node.js インストール

1. https://nodejs.org/ から LTS版をダウンロード
2. インストール（デフォルト設定でOK）
3. 確認:
   ```powershell
   node --version   # v20.x.x 以上
   npm --version    # 10.x.x 以上
   ```

### 1.2 Git インストール（任意だが推奨）

1. https://git-scm.com/ からダウンロード
2. インストール

---

## Step 2: プロジェクトファイルのコピー

### 方法A: フォルダごとコピー（シンプル）

1. 開発PCの `F:\Antigravity\stock-pwa` フォルダを丸ごとコピー
2. サーバーPCの任意の場所に貼り付け（例: `C:\Apps\stock-pwa`）

**注意**: `node_modules` フォルダは除外してもOK（後で再インストール）

### 方法B: Git経由（推奨）

```powershell
# サーバーPCで実行
cd C:\Apps
git clone https://github.com/kojimayu/stock-pwa.git
cd stock-pwa
```

---

## Step 3: 依存関係のインストール

```powershell
cd C:\Apps\stock-pwa  # 移行先のパスに変更
npm install
```

---

## Step 4: Access DB パスの設定

### 4.1 Access DB の共有設定（Access DB PC側）

1. Access DBが入っているフォルダを右クリック → 「プロパティ」
2. 「共有」タブ → 「共有」ボタン
3. 適切なユーザー/グループに読み取り権限を付与
4. 共有パスをメモ（例: `\\ACCESS-PC\共有フォルダ`）

### 4.2 サーバーPC側の設定

**方法A: 環境変数で設定（推奨）**

プロジェクトルートに `.env` ファイルを作成:

```env
# .env
ACCESS_DB_PATH=\\\\ACCESS-PC\\共有フォルダ\\作業管理・２０１１年７月以降.accdb
```

> **注意**: パス内の `\` は `\\` に置き換えてください

**方法B: システム環境変数で設定**

1. 「システム環境変数の編集」を開く
2. 「環境変数」ボタンをクリック
3. 「システム環境変数」→「新規」
4. 変数名: `ACCESS_DB_PATH`
5. 変数値: `\\ACCESS-PC\共有フォルダ\作業管理・２０１１年７月以降.accdb`

### 4.3 設定箇所（参考）

Access DBパスを使用しているファイル:
- `app/api/access/route.ts` (物件検索API)
- `app/api/access/vendors/route.ts` (業者リストAPI)

デフォルト値: `C:\AccessData\作業管理・２０１１年７月以降.accdb`

環境変数 `ACCESS_DB_PATH` が設定されていればそちらが優先されます。

### 4.4 接続テスト

サーバーPCからAccess DBにアクセスできるか確認:

```powershell
# ネットワークパスの疎通確認
Test-Path "\\ACCESS-PC\共有フォルダ\作業管理・２０１１年７月以降.accdb"
# True と表示されればOK
```

---

## Step 5: 環境変数の設定（必要に応じて）

`.env` ファイルがある場合は、サーバーPCにもコピーまたは作成。

```powershell
# .env.example を参考に .env を作成
cp .env.example .env
# 必要な値を編集
```

---

## Step 6: 本番ビルド

```powershell
npm run build
```

ビルドが成功すれば `.next` フォルダが生成される。

---

## Step 7: 動作確認

### 7.1 サーバー起動

```powershell
npm run start
```

### 7.2 ローカル確認

- ブラウザで `http://localhost:3000` にアクセス
- 正常に表示されることを確認

### 7.3 タブレットから確認

1. サーバーPCのIPアドレスを確認
   ```powershell
   ipconfig
   ```
2. タブレットのブラウザで `http://[サーバーIP]:3000` にアクセス

---

## Step 8: 自動起動設定（本番運用）

### 8.1 スタートアップスクリプト作成

`C:\Apps\stock-pwa\start_server.bat`:
```batch
@echo off
cd /d C:\Apps\stock-pwa
npm run start
```

### 8.2 タスクスケジューラで自動起動

1. タスクスケジューラを開く
2. 新しいタスク作成
3. トリガー: 「ログオン時」
4. 操作: `C:\Apps\stock-pwa\start_server.bat` を実行

---

## 移行後のチェックリスト

- [ ] Node.js インストール済み
- [ ] プロジェクトファイルをコピー済み
- [ ] `npm install` 完了
- [ ] Access DB のネットワークパスを設定済み
- [ ] `npm run build` 成功
- [ ] `npm run start` でサーバー起動確認
- [ ] タブレットからアクセス確認
- [ ] バックアップスクリプトのパスを更新
- [ ] タスクスケジューラ設定完了
- [ ] ファイアウォールでポート3000を許可

---

## トラブルシューティング

### タブレットから接続できない

1. **ファイアウォール確認**
   ```powershell
   # ポート3000を許可
   New-NetFirewallRule -DisplayName "Stock-PWA" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   ```

2. **IPアドレス確認**
   ```powershell
   ipconfig
   # IPv4 アドレスを確認
   ```

### Access DB に接続できない

1. ネットワークパスにアクセスできるか確認
   ```powershell
   Test-Path "\\ACCESS-PC\共有フォルダ\database.mdb"
   ```

2. 共有設定・権限を再確認

### ビルドエラー

```powershell
# node_modules を削除して再インストール
Remove-Item -Recurse -Force node_modules
npm install
npm run build
```
