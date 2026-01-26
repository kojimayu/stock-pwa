# Phase 4: 通知・メール機能 (Notifications)

## 目標 (Goal)
出庫完了時に、業者および管理者に対して明細メール（金額入り）を自動送信する機能を実装します。
これにより、現場での金額表示を隠しつつ、経理・管理上の記録を確実に残すことが可能になります。

## User Review Required
- **メール配信サービス**: **Microsoft Graph API** を使用します。
    - Tech: Azure AD App Registration (Client Credentials)
    - Auth: テナントID, クライアントID, クライアントシークレットが必要です。
    - **Permission**: `Mail.Send` (**Application** permissions) が必要です。
    - **Consent**: テナント全体の「管理者の同意 (Admin Consent)」が必須です。
- **送信先**:
    - **業者**: 管理画面で設定した各業者のメールアドレス。
    - **業者**: Vendorマスタに追加するメールアドレス宛。
    - **管理者**: 環境変数 `ADMIN_EMAIL` で指定する固定アドレス宛（BCCまたは別送）。

## Proposed Changes

### 1. データベース更新 (Schema Update)
- **[MODIFY] `prisma/schema.prisma`**
    - `Vendor` モデルに `email` (String?, nullable) を追加。
    - Migration: `add_vendor_email`

### 2. 業者管理画面 (Admin UI)
- **[MODIFY] `components/admin/vendor-dialog.tsx`**
    - メールアドレス入力欄を追加。
- **[MODIFY] `lib/actions.ts`**
    - `upsertVendor` で email を保存するように修正。

### 3. メール送信機能 (Email Service)
- **[NEW] `lib/mail.ts`**
    - **Microsoft Graph API** を使用してメールを送信。
    - 認証: Client Credentials Flow (Tenant ID, Client ID, Client Secret).
    - 環境変数: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `SMTP_FROM_ADDRESS`.
    - HTMLメールテンプレートを作成（表形式で明細・金額を表示）。
- **テンプレート内容**:
    - 件名: 【出庫完了】[業者名]様 取引明細
    - 本文: 日時、業者名、商品明細（商品名、単価、数量、小計）、合計金額。

### 4. 出庫処理連携 (Checkout Integration)
- **[MODIFY] `lib/actions.ts` -> `createTransaction`**
    - トランザクション完了後、非同期でメール送信関数を呼び出し。
    - ※メール送信の失敗でトランザクションをロールバックは**しない**（ログ出力のみ）。

    - [x] **検証 (Verification)**
        - [x] 実際にメールが届くか確認 (Test Email)

# Phase 5: 原価管理・仕入先対応 (Cost Management & Multi-Supplier)
## 目標 (Goal)
仕入れ値（原価）と販売価格のバランスを可視化し、利益管理ができるようにする。
同種の商品でもメーカー（仕入先）の違いに対応し、それぞれの原価を管理する。

## User Review Required
- **Excelフォーマット更新**:
    - **`cost`** (仕入れ値): 必須。利益計算の基礎となります。
    - **`supplier`** (メーカー/仕入先): 任意。同じ商品でもメーカー違いを区別する場合に使用。
    - `code` (商品ID): **型番 (Model Number)** やJANコードを推奨します。現場で箱を見て確認できるため、「00001」のような連番より実用的です。
        - 例: `LD-70-I` (因幡電工 アイボリー), `DAS080W` (Panasonic)
        - メーカー違いはこれで区別します。

## Future Extensibility (Cost Automation)
- **価格改定対応**: 将来的には `ProductCostHistory` テーブルを作成し、「適用開始日（EffectiveDate）」を持たせることで、事前に価格改定データを投入し、自動で切り替える機能へ拡張可能です。
- **請求データ連携**: 問屋からのCSV/請求データを取り込むための API エンドポイントを追加しやすい設計（Server Action分離）にします。
- **今回の実装**: まずは `Product` テーブルに `cost` (現在原価) を持たせ、**Excelによる一括更新（上書き）** で運用を開始します。

## Proposed Changes
### 1. データベース更新 (Schema Update)
- **[MODIFY] `prisma/schema.prisma`**
    - `Product` モデルにフィールド追加:
        - `code` (String, @unique): 商品ID。
        - `color` (String?): 色。
        - **`cost`** (Int): 仕入れ単価（原価）。デフォルト0。
        - **`supplier`** (String?): メーカー名/仕入先名。
    - Migration: `add_product_cost_supplier`

### 2. UI実装 (Import & Analysis)
- **[NEW] `components/admin/product-import-dialog.tsx`**
    - `cost`, `supplier` カラムのインポートに対応。
- **[NEW] `components/admin/product-export-button.tsx`**
    - 登録済みデータをExcel形式でダウンロードするボタン。
    - インポート用フォーマットと互換性を持たせ、編集後の再アップロードを支援。
- **[MODIFY] `components/admin/product-list.tsx`**
    - 一覧に「原価」「利益率」を表示（利益率 = (売価 - 原価) / 売価）。
    - 利益率が低い商品（例: 10%以下）をアラート表示する機能を追加。
- **[NEW] `app/(admin)/analysis/page.tsx` (Profit Analysis)**
    - 原価高騰への対応として、現在の在庫資産額（原価ベース vs 売価ベース）を比較できる簡易レポート画面。

### 3. Server Action
- **[MODIFY] `lib/actions.ts`**
    - `importProducts`: 新しいカラムに対応。
    - `getAllProducts`: 全件取得用（Export用）のアクションを追加（既存の `getProducts` を流用可能か確認）。
    - `getDashboardStats`: 在庫資産額（Total Cost）の集計を追加。

## Future Extensibility: 色違い商品の効率管理 (Color Variants)
現状は「型番ごとに1行」が必要ですが、以下の機能を追加することで登録の手間を削減できます。

### 提案機能: カラー展開ウィザード (Color Expansion)
1.  **Excel**: `isColor` (色展開あるか) というカラムを用意し、そこに `TRUE` または `1` `〇` がある場合、自動的に以下の5色に展開します。
2.  **展開ルール**:
    - `アイボリー` (Suffix: `-IV`)
    - `ブラウン` (Suffix: `-BN`)
    - `ブラック` (Suffix: `-BK`)
    - `ホワイト` (Suffix: `-WH`)
    - `グレー` (Suffix: `-GY`)
    - ※ID (code) の末尾に上記サフィックスを付与します。
    - ※商品名の末尾に `(色名)` を付与します。
3.  **実装**: `product-import-dialog.tsx` 内で、`isColor`行を検出し、5行分のデータを作成してからプレビューに渡します。

※今回はまず「1行1商品」の基本形を完成させますが、次のステップとしてこの「自動展開インポート」を実装可能です。

# Phase 6: 本番運用準備 (Deployment & Operation)
## 目標 (Goal)
社内の非開発用Windows PC (オンプレミス) にシステムを移行し、永続的に運用可能な状態にする。
あわせて、SQLiteデータベースのバックアップ体制を構築する。

## User Review Required
- **運用PCスペック**: Node.jsが動作する一般的なWindows PCが必要です。
- **バックアップ先**: データの安全性を確保するため、**OneDrive/Google Drive等のクラウド同期フォルダ**、またはNASへのバックアップを推奨します。

## Proposed Steps
### 1. 移行手順 (Migration)
1.  **環境構築**: 運用PCに `Node.js (LTS版)` と `Git` をインストール。
2.  **ソースコード配置**: 
    - 方法A: Git経由 (`git clone`) ※推奨
    - 方法B: フォルダコピー (`node_modules`, `.next` 除く)
3.  **セットアップ**:
    - `npm install`
    - `.env` ファイルの設定 (本番用の環境変数)
    - `npx prisma migrate deploy` (DB初期化)
    - `npm run build` (ビルド)

### 2. 起動設定 (Process Management)
- **PM2 (Process Manager)** を採用。
    - アプリの永続化（クラッシュ時の自動再起動）。
    - Windows起動時の自動起動設定 (`pm2-startup-install`)。

### 3. バックアップ (Backup)
- **PowerShellスクリプト** を作成 (`scripts/backup_db.ps1`)。
    - `dev.db` を「日付付きファイル名」でコピー。
    - 保存先は設定で変更可能にする。
- **Windows タスクスケジューラ**: 1日1回（夜間など）スクリプトを自動実行。

## Verification Plan
1.  **インポート動作**: Excelファイルを取り込み、商品一覧に追加されるか。
2.  **上書き確認**: 既存の商品名をインポートした場合、情報（価格など）が更新され、在庫は維持されるか。
3.  **移行確認**: 別のPCからアクセスできるか。
「いつ」「誰が」「何をしたか」を記録し、システム上の重要な変更（価格変更、商品削除、一括インポートなど）を追跡可能にする。
-
**[MODIFY]
prisma/schema.prisma**
-
OperationLog モデル追加
-
**[MODIFY]
lib/actions.ts**
-
以下の箇所にログ保存処理を追加:
-
importProducts:
Imported N items
ログ
-
deleteProduct:
削除ログ
-
操作ログ一覧を表示するテーブル。
-
日時降順で最新の操作を確認可能。
