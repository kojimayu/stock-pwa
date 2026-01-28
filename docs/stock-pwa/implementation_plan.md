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

# Phase 9: 手入力商品のマスタ登録・運用改善 (Manual Item Registration & Workflow)
## 目標 (Goal)
手入力で取引された（マスタ未登録の）商品を、管理画面からワンクリックで正式な商品マスタに昇格（登録）できるようにする。
また、Kiosk画面での手入力商品の金額表示を適正化（0円または非表示）する。

## Proposed Changes
### 1. Kiosk UI 調整
- **[MODIFY] `components/kiosk/cart-item.tsx` (仮)** / `CartSummary`
    - 手入力商品 (`isManual: true`) の場合、単価・金額を「-」や「※後日精算」などの表示にするか、0円であることを明確にする。
    - ユーザー要望: **金額の表示・操作はできないように**。

### 2. Admin UI 実装
- **[MODIFY] `components/admin/product-dialog.tsx`**
    - `initialData` プロップスを追加し、新規作成時に「名前」などをプレ入力できるようにする。
    - `product` (編集) と `initialData` (新規テンプレート) を区別して扱う。
- **[MODIFY] `components/admin/transaction-list.tsx`**
    - 手入力商品が含まれる行、または商品の横に「マスタ登録」ボタンを配置。
    - クリックすると `ProductDialog` が開き、商品名が入力された状態で立ち上がる。
    - 登録完了後、取引データ自体はそのままだが、次回以降の取引で検索に出てくるようになる。

# Phase 10: 手入力商品の紐付け・在庫整合 (Reconciliation)
## 目標 (Goal)
「実はマスタにあったのに手入力してしまった」ケースに対し、管理画面から後追いで既存商品へ紐付け（名寄せ）を行い、在庫と売上データを補正する。

## Proposed Changes
### 1. Admin UI: 紐付け機能
- **[MODIFY] `components/admin/transaction-list.tsx`**
    - 「マスタ登録」ボタンの横に「**既存商品に紐付け**」ボタンを追加。
    - クリックすると、商品検索ダイアログが開く。
    - 既存の商品を選択して「確定」。

### [x] **Admin UI**: 取引履歴に「既存商品に紐付け」アクション追加
    - [x] **Action**: `reconcileTransactionItem` 実装 (JSON更新 + 在庫減算)
    - [x] **UI**: 商品検索・選択ダイアログの実装

# Phase 11: 価格自動計算 (Automated Pricing)
## Proposed Changes
### Logic Specification (価格決定ロジック)
Excelインポートおよび商品登録時の誤入力防止と柔軟性を両立するため、以下のロジックを採用します。

1.  **基本ルール (Default)**:
    - **仕入原価 (`Cost`) のみ**を入力してください。
    - 販売単価 (`PriceA`, `PriceB`) は**空欄または0**にしておきます。
    - システムが自動的に計算します: `PriceA = Cost * 1.20`, `PriceB = Cost * 1.15` (切り上げ)。

2.  **イレギュラー対応 (Manual Override)**:
    - 「端数を980円に揃えたい」「戦略的に安くしたい」などの場合のみ、販売単価を入力します。
    - **値が入力されている場合**、自動計算を行わず、入力値を優先（正）とします。
    - [ ] **UI表示**: 自動計算と異なる値が設定されている場合、その旨を明示する（「手動設定」アイコン等）。

3.  **安全装置 (Safety Net)**:
    - もし手入力でミス（桁間違い等）をして原価を下回ってしまった場合、既存のバリデーションエラー (`Price >= Cost`) が作動し、登録をブロックします。これにより「安売りミス」を防ぎます。

- **ProductDialog (Admin)**:
    - [x] 仕入原価 (Cost) 入力時に販売単価を自動計算
        - Price A = Cost * 1.20 (切り上げ)
        - Price B = Cost * 1.15 (切り上げ)
    - [x] 入力フィールドを再表示 (金額入力は可能だが、原価入力で上書きされる仕様)
- **Import (Admin)**:
    - [x] Excelインポート時も同様のロジックを適用
    - [x] 売価が空欄または0の場合、原価から自動計算して登録

### 3. Backend Logic: 補正処理
- **[NEW] Action: `reconcileTransactionItem`**
    - 引数: `transactionId`, `manualItemName`, `targetProductId`
    - 処理内容:
        1.  対象の `Transaction` の `items` JSON を更新（手入力データを正規の商品データで置換）。
        2.  **在庫減算**: 紐付けた商品の在庫を、取引時の数量分だけ減算する（`Product.update`）。
        3.  **ログ記録**: `InventoryLog` に「手入力紐付けによる出庫」として記録。
        4.  フラグ更新: `Transaction.hasUnregisteredItems` を再評価。
    - これにより、原価計算や在庫数が事後的に正しくなる。

# Phase 12: 単位追加・棚卸機能 (Unit & Inventory Count)
## 目標 (Goal)
商品ごとの単位（個、本、m、箱など）を管理し、Excel連携を強化する。
また、実地棚卸（在庫カウント）を行い、システム在庫との差異を調整する機能を実装する。

## Proposed Changes
### 1. 単位カラムの追加 (Unit Column)
- **Database**: `Product` モデルに `unit` (String, default: "個") を追加。
- **UI**:
    - [x] `ProductDialog`: 単位入力欄を追加（"個", "本", "m", "箱", "セット" などの候補を表示）。
    - [x] `Import/Export`: Excelに `unit` カラムを追加。

### 2. 棚卸機能 (Inventory Taking)
- **Database**:
    - [x] `InventoryCount` (棚卸実施記録).
    - [x] `InventoryCountItem` (棚卸明細).
- **UI (Page: `/admin/inventory`)**:
    - [x] **棚卸開始**: `createInventoryCount` Action.
    - [x] **在庫入力**: `InventoryDetail` Component.
    - [x] **差異確認**: リアルタイム計算表示.
    - [x] **確定処理**: `finalizeInventory` Action.
- **Logic**:
    - [x] 運用: 棚卸中(`IN_PROGRESS`)は、**入出庫操作（レジ精算、商品インポート）をシステム的にブロック**する。
    - [x] UI: 棚卸実施中は画面に「棚卸中につき操作制限中」の警告を表示する。

# Phase 13: 発注管理機能 (Order Management)
## 目標 (Goal)
在庫切れを防ぐため、基準在庫 (`minStock`) を下回った商品の発注リストを自動生成し、承認フローを経て発注・入荷まで管理する。

## Proposed Changes
### 1. データベース (Database)
- **[NEW] `Order` Model**: 発注書
    - `id`, `vendorId` (自動仕分け用), `status` (DRAFT, ORDERED, PARTIAL, RECEIVED, CANCELLED), `createdAt`, `updatedAt`
- **[NEW] `OrderItem` Model**: 発注明細
    - `orderId`, `productId`, `quantity` (発注数), `cost` (発注時単価)
    - `receivedQuantity` (入荷済数), `isReceived` (行完了フラグ)

### 2. Logic: 自動発注 (Automated Draft)
- **Action**: `generateDraftOrders`
    - `Product.stock < minStock` の商品を抽出。
    - `Product.supplier` (仕入先) ごとに `Order (DRAFT)` を作成。
    - 発注数 = `minStock - stock + α` (αは運用ルール、一旦 `minStock - stock + 1` 程度または `minStock` まで回復する数)

### 3. UI: 発注管理画面 (`/admin/orders`)
- **一覧画面**: ステータスごとの発注書一覧。
- **ドラフト作成**: 「発注候補を作成」ボタン。
- **詳細・編集画面**:
    - **承認フェーズ**: 数量修正、商品追加削除 → 「発注確定」でステータス `ORDERED`。
    - **入荷フェーズ**:
        - 各行に「入荷数」入力欄と「入荷チェック」ボタン（またはチェックボックス）を設置。
        - **個別の入荷処理**:
            - 実際に入荷した数を入力して確定 → 在庫加算 & `receivedQuantity` 更新。
            - 発注数と入荷数が一致すればその行は完了 (`isReceived = true`)。
        - 全行が完了すると、発注書全体のステータスが自動的に `RECEIVED` になる。

# Phase 14: UI/UX 現場ファースト改善 (Field-First Enhancements)
## 目標 (Goal)
デザインレビューの指摘に基づき、屋外の過酷な環境や手袋着用時でも快適に、かつ確実に動作する UI/UX を実現します。また、PWA としての品質を向上させ、不安定な通信環境でも安心して利用できる状態にします。

## Proposed Changes

### 1. 操作性向上 (Operability)
- **[MODIFY] `components/ui/button.tsx`**
    - `size` バリアントに `touch` (h-12, px-6, text-lg) を追加。
- **[MODIFY] `components/ui/input.tsx`**
    - `className` に `h-12 text-lg` 等、大型化するためのプロパティをサポート、または `size="touch"` に相当するクラスを適用可能にする。

### 2. PWA 品質向上 (PWA Quality)
- **[NEW] `app/manifest.ts`**
    - Next.js の Metadata API を利用してマニフェストを動的生成。
    - アプリ名、アイコン、スプラッシュ画面の色、表示モードを定義。
- **[NEW] `public/icons/`**
    - `icon-192x192.png`, `icon-512x512.png` などのアセットを配置。

### 3. オフライン対応 (Offline Visibility)
- **[NEW] `components/network-status.tsx`**
    - `navigator.onLine` を監視し、オフライン時に「オフラインモード」バナーを表示。

### 4. 視認性調整 (Visibility)
- **[MODIFY] `app/globals.css`**
    - フォーカス時の `ring` をより太く、視認性の高い色に変更。

## Verification Plan
### Manual Verification
- **操作性**: スマホの実機でボタンが指一本で押しやすいサイズ（48px以上）になっているか。
- **PWA**: ブラウザで「インストール」が可能か、ホーム画面でのアイコンが正しいか。
- **オフライン**: オフライン時に警告バナーが表示されるか。

---

# Phase 15: デバイス別UI最適化 (Device-Specific Optimization)

## 目標
使用シーンに合わせたデバイス最適化を行い、ストレスのない操作を実現する。

## Proposed Changes

### 1. Kiosk (タブレット想定)
- [ ] **商品グリッド**: タブレットの大画面を活かし、1行あたりの表示数を調整（3〜4列）。
- [ ] **フォントサイズ**: 商品名や価格のフォントサイズを拡大。
- [ ] **レイアウト**: 右側のカートエリアを固定し、スクロールなしで決済ボタンにアクセス可能にする。

### 2. 棚卸・発注 (スマホ想定)
- [ ] **スマホ特化表示**: Admin内の「棚卸」「発注」ページにおいて、スマホ時のみテーブルから「カード形式」のリストへ切り替え。
- [ ] **Sticky Footer**: 「決定」「確定」などの主要操作ボタンをスマホ表示時に画面下部に固定。
- [ ] **入力エリア**: 数値入力欄（入荷数・棚卸数）を画面幅いっぱいに、または指で触れやすい位置に配置。

### 3. PC管理面 (商品登録・設定など)
- [ ] **データ密度**: 一覧性を重視し、1画面に表示できる情報量を維持。
- [ ] **PC特化レイアウト**: 広範な情報を一度に視認できるよう、サイドバーとのバランスを調整。

## Verification Plan
### Manual Verification
- **DevTools**: Chrome DevToolsで「iPad」「iPhone 12/13/14」を切り替え、各画面のレイアウトが想定通りかを確認。
- **実機検証**: スマホでの片手入力、タブレットでの一覧視認性を確認。
