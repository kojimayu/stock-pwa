# Phase 2: 管理画面 (PC/事務所)

## 目標 (Goal)
事務所の管理者がPCで利用する、在庫管理・取引履歴確認用のダッシュボード基盤を構築します。
タブレット(Kiosk)が手元になくても開発・検証可能なPC向け画面を優先します。

## ユーザーレビュー事項 (User Review Required)
- **レイアウト**:
    - 左側にサイドバー（ナビゲーション）、右側にメインコンテンツを配置する一般的な管理画面レイアウトを採用します。
    - `shadcn/ui` の `Sidebar` コンポーネント（もしあれば）や標準的なFlexboxレイアウトを使用します。

## 実装内容 (Proposed Changes)

### 1. アーキテクチャ & レイアウト
- **[NEW] `app/(admin)/layout.tsx`**
    - サイドバーを含む管理画面共通レイアウト。
    - レスポンシブ対応（モバイルではハンバーガーメニュー等）も考慮しますが、基本はPC最適化。
- **[NEW] `components/admin/sidebar.tsx`**
    - ナビゲーションリンク:
        - ダッシュボード (`/admin`)
        - 取引履歴 (`/admin/transactions`)
        - 業者管理 (`/admin/vendors`)
        - 商品管理 (`/admin/products`)

### 2. ダッシュボード (ホーム)
- **[NEW] `app/(admin)/page.tsx`**
    - 概要を表示するページ。
    - とりあえず「直近の取引」のプレースホルダーや、システムステータスを表示。

### 3. ルーティング設定
- `(admin)` グループを作成し、`/admin` 以下のルートを管理。

## 検証計画 (Verification Plan)
### 自動テスト
- 現状はなし（UI構築優先）

### 手動検証
1. Browser Tool または ローカルサーバーで `http://localhost:3000/admin` にアクセス。
2. サイドバーが表示され、各リンクが機能する（ページ遷移する、または404にならずプレースホルダーが表示される）ことを確認。

### 5. 商品管理 (Product Management)
- **パス**: /admin/products
- **機能**:
    - **商品一覧**: 基本情報と現在在庫数の表示。
    - **商品編集**: 名前、カテゴリ、価格A/B、下限在庫数の変更（※在庫数はここでは変更不可）。
    - **在庫調整 (本格版)**:
        - 専用の「在庫調整」ダイアログ。
        - 区分: 「入庫」「棚卸」「その他」を選択。
        - 数量: 増減値を入力。
        - 履歴記録: InventoryLog テーブルに理由とともに記録。
- **データモデル変更**:
    - InventoryLog モデルの追加 (productId, type, quantity, reason, createdAt)。
    - Product モデルにリレーション追加。
- **コンポーネント**:
    - ProductTable
    - ProductFormDialog: マスタ情報の編集用。
    - StockAdjustmentDialog: 在庫数の変更用。

### 8. 取引履歴 (Transaction History)
- **パス**: /admin/transactions
- **機能**:
    - 全取引の時系列一覧表示。
    - 取引詳細の表示（どの商品が何個、合計金額）。items JSONのパースが必要。
- **コンポーネント**:
    - TransactionList (or Page inline if simple)
- **ロジック**:
    - getRecentTransactions を流用、またはページネーション対応版を作成（今回は簡易的に全件または100件取得）。
