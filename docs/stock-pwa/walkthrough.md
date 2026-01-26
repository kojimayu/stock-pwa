# Admin Dashboard Implementation Walkthrough

## 変更内容 (Changes)

### 1. 管理画面レイアウト
- `app/(admin)/layout.tsx`: サイドバーを含む管理画面の共通レイアウトを作成。
- `components/admin/sidebar.tsx`: ダッシュボード、取引履歴、マスタ管理へのリンクを含むサイドバーを実装。

### 2. ダッシュボード画面
- `app/(admin)/page.tsx`:
    - **統計カード**: 総在庫数、本日の取引数、累計取引数を表示。
    - **取引履歴テーブル**: 直近の取引履歴を表示（詳細ボタン等は未実装）。

### 3. バックエンド (Server Actions)
- `lib/actions.ts`:
    - `getDashboardStats()`: 統計情報の集計（現在は簡易的なCount/Sum）。
    - `getRecentTransactions(limit)`: 取引データの取得（Vendor情報をinclude）。

### 4. ユーティリティ
- `lib/utils.ts`: 通貨フォーマット (`formatCurrency`)、日付フォーマット (`formatDate`) を追加。

### 5. データ
- `prisma/seed.ts`: ダッシュボード表示確認用のダミー取引データ生成処理を追加。

## 検証結果 (Validation)

### 動作確認
- [x] `http://localhost:3000/admin` にアクセス可能。
- [x] サイドバーが表示され、デザインが崩れていないこと。
- [x] 統計カードに数字が表示されること。
- [x] 「最近の取引」テーブルにシードデータ（Test Vendorの購入履歴）が表示されていること。

## スクリーンショット
(ここにスクリーンショットを追加予定)

### 7. 商品管理 (Product Management)
- **ページ**: /admin/products
- **機能**: 一覧表示, 基本情報編集(ProductDialog), 在庫調整(StockAdjustmentDialog), 削除
- **在庫調整**: InventoryLog を介したトランザクション更新(入庫/廃棄/訂正/返品)

### 8. 取引履歴 (Transaction History)
- **ページ**: /admin/transactions
- **機能**: 直近100件の取引一覧表示, JSONパースによる内訳表示

## Phase 3: キオスクUI (タブレット/倉庫)
- **業者ログイン**:
    - **Select-then-PIN**: 業者をリストから選択し、PINコードで認証する2ステップ方式を採用。
    - **Security**: セッションは `Zustand` (persist) で管理し、完了画面やタイムアウト時にクリア。
- **商品選択 (Shop)**:
    - **Grid Layout**: タッチ操作しやすい大きなカード表示。
    - **Quantity Selector**: 商品選択時にダイアログで数量を指定。「10個」「20個」などのプリセットボタンで箱単位の選択を効率化。
    - **Price Hidden**: 現場での利用を考慮し、金額表示を削除。
- **出庫・決済 (Checkout)**:
    - **Confirmation**: カート内容の確認と数量変更が可能。
    - **Completion**: 出庫完了後、5秒で自動的にログイン画面へリダイレクト。
- **その他**:
    - **履歴 (History)**: 過去の出庫履歴を確認可能。
    - **Auto-Logout**: 5分間の無操作で自動的にログアウト。

## Phase 4: 通知・メール機能 (Notifications)
- **概要**: 出庫・精算完了時に、業者および管理者へメール通知を行う。
- **技術スタック**: Microsoft Graph API (`/me/sendMail`)
- **認証**: 
    - Azure AD App Registration (Client Credentials Flow)
    - Permission: `Mail.Send` (Application)
    - **Admin Consent** が必須。
- **実装詳細**:
    - `lib/mail.ts`: Graph API のアクセストークン取得とメール送信ロジック。
    - `lib/actions.ts`: トランザクション完了後に非同期でメール送信を実行（UIブロック回避）。
    - メール本文: HTML形式の表組みで、商品ごとの内訳と合計金額（現場では非表示の情報）を通知。
