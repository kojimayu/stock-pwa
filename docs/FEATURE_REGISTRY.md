# 機能レジストリ (Feature Registry)

> **目的**: 本ファイルは、STOCK-PWA の全機能を一元管理する「信頼できる唯一の情報源」です。
> 新機能追加時は必ずこのファイルに追記してください。

**最終更新**: 2026-02-19

---

## Kiosk（現場端末） — 20機能

| # | 機能名 | 画面/コンポーネント | サーバーアクション | テスト |
|---|--------|-------------------|-------------------|--------|
| K1 | 業者ログイン（PIN） | `(kiosk)/page.tsx` | `verifyPin` | ⬜ |
| K2 | 担当者選択 | `(kiosk)/page.tsx` | `getVendorUsers` | ⬜ |
| K3 | 新規担当者登録（自己登録） | `(kiosk)/page.tsx` | `createVendorUser` | ⬜ |
| K4 | PIN変更 | `change-pin/page.tsx` | `changePin` | ⬜ |
| K5 | モード選択（部材/エアコン） | `mode-select/page.tsx` | — | ⬜ |
| K6 | 部材一覧表示（カテゴリ/検索） | `shop-interface.tsx` | `getShopProducts` | ⬜ |
| K7 | カート管理（追加/削除/数量変更） | `cart-sidebar.tsx` | — (Zustand) | ⬜ |
| K8 | 部材チェックアウト（在庫チェック付き） | `cart-sidebar.tsx` | `createTransaction` | ⬜ |
| K9 | 手入力商品追加 | `manual-product-sheet.tsx` | — | ⬜ |
| K10 | 在庫確認ダイアログ（出庫後） | `stock-verification-dialog.tsx` | — | ⬜ |
| K11 | ペア商品警告（奇数個） | `quantity-selector-dialog.tsx` | — | ⬜ |
| K12 | 部材履歴表示 | `shop/history/page.tsx` | `getVendorTransactions` | ⬜ |
| K13 | 返品処理（履歴から） | `vendor-history-edit-dialog.tsx` | `createReturnFromHistory` | ⬜ |
| K14 | エアコン持出し（在庫チェック付き） | `aircon/page.tsx` | API: `/api/aircon/transaction` | ⬜ |
| K15 | エアコン履歴 | `aircon/history/page.tsx` | API: `/api/aircon/logs` | ⬜ |
| K16 | 管理No検索（Access DB連携） | `aircon/page.tsx` | API: `/api/access` | ⬜ |
| K17 | 自動ログアウト（10分） | `idle-timer.tsx` | `logLogout` | ⬜ |
| K18 | 手動ログアウト | `logout-button.tsx` | `logLogout` | ⬜ |
| K19 | オフラインアラート | `offline-alert.tsx` | — | ⬜ |
| K20 | 認証ガード（未ログイン防止） | `auth-guard.tsx` | — | ⬜ |

## Admin（管理画面） — 26機能

| # | 機能名 | 画面/コンポーネント | サーバーアクション | テスト |
|---|--------|-------------------|-------------------|--------|
| A1 | ダッシュボード（統計表示） | `admin/page.tsx` | `getDashboardStats` | ⬜ |
| A2 | 商品一覧・検索・フィルタ | `product-list.tsx` | `getProducts` | ⬜ |
| A3 | 商品追加・編集 | `product-dialog.tsx` | `upsertProduct` | ⬜ |
| A4 | 商品削除 | `product-list.tsx` | `deleteProduct` | ⬜ |
| A5 | 商品CSVインポート | `product-import-dialog.tsx` | `importProducts` | ⬜ |
| A6 | 商品CSVエクスポート | `product-export-button.tsx` | — | ⬜ |
| A7 | 在庫調整（手動入出庫） | `stock-adjustment-dialog.tsx` | `adjustStock` | ⬜ |
| A8 | 取引履歴一覧 | `transaction-list.tsx` | `getTransactions` | ⬜ |
| A9 | 取引編集（数量・商品変更） | `transaction-edit-dialog.tsx` | `updateTransaction` | ⬜ |
| A10 | 取引返品（全額/一部） | `transaction-return-dialog.tsx` | `returnTransaction`, `returnPartialTransaction` | ⬜ |
| A11 | 価格修正 | `price-correction-dialog.tsx` | `correctTransactionPrice` | ⬜ |
| A12 | 業者管理（CRUD/有効無効） | `vendor-list.tsx`, `vendor-dialog.tsx` | `getAllVendors`, `upsertVendor`, `toggleVendorActive` | ⬜ |
| A13 | 業者QRコード生成 | `vendor-qr-dialog.tsx` | `generateQrToken` | ⬜ |
| A14 | 業者Accessインポート | `vendor-list.tsx` | `importVendorsFromAccess` | ⬜ |
| A15 | 担当者PINリセット | `vendor-dialog.tsx` | `resetPin` | ⬜ |
| A16 | 棚卸し（開始/実査/確定） | `inventory-list.tsx`, `inventory-detail.tsx` | `createInventoryCount`, `updateInventoryItem`, `finalizeInventory` | ⬜ |
| A17 | 発注管理（自動生成/手動作成） | `order-list.tsx` | `getOrders`, `generateDraftOrders`, `createManualOrder` | ⬜ |
| A18 | 発注入荷処理 | `order-detail.tsx` | `receiveOrderItem`, `cancelReceipt` | ⬜ |
| A19 | 操作ログ閲覧 | `logs/page.tsx` | `getOperationLogs` | ⬜ |
| A20 | エアコン在庫管理 | `aircon-stock/page.tsx` | `getVendorAirconStock` | ⬜ |
| A21 | エアコン履歴閲覧 | `aircon-logs/page.tsx` | — | ⬜ |
| A22 | 代理入力（部材） | `proxy-input/` | `createTransaction` (isProxyInput) | ⬜ |
| A23 | 代理入力（エアコン） | `proxy-input/` | API: `/api/aircon/transaction` | ⬜ |
| A24 | 収益分析 | `analysis/page.tsx` | `getAnalysisData` | ⬜ |
| A25 | 管理者パスワード変更 | `change-password/` | — | ⬜ |
| A26 | サイドバー折りたたみメニュー | `sidebar.tsx` | — | ⬜ |

## API — 6エンドポイント

| # | エンドポイント | 用途 | テスト |
|---|-------------|------|--------|
| API1 | `GET /api/access?managementNo=&vendorName=` | Access DBから物件情報取得 | ⬜ |
| API2 | `GET /api/access/vendors` | Access DBから業者リスト取得 | ⬜ |
| API3 | `POST /api/aircon/transaction` | エアコン持出し記録（在庫チェック付き） | ⬜ |
| API4 | `GET /api/aircon/logs` | エアコン履歴取得 | ⬜ |
| API5 | `POST /api/auth/[...nextauth]` | NextAuth管理者認証 | ⬜ |
| API6 | `GET /api/health` | ヘルスチェック | ⬜ |

## データモデル — 15テーブル

| モデル | 用途 |
|--------|------|
| `Vendor` | 業者（会社） |
| `VendorUser` | 業者担当者（PIN認証） |
| `Product` | 部材商品マスタ |
| `InventoryLog` | 在庫変動ログ |
| `InventoryCount` | 棚卸しセッション |
| `InventoryCountItem` | 棚卸し詳細 |
| `Transaction` | 部材取引（出庫/返品） |
| `OperationLog` | 操作ログ（監査用） |
| `Order` | 発注 |
| `OrderItem` | 発注商品明細 |
| `AirConditionerLog` | エアコン持出し記録 |
| `AirconProduct` | エアコン商品マスタ |
| `AirconOrder` | エアコン発注 |
| `AirconOrderItem` | エアコン発注明細 |
| `AdminUser` | 管理者ユーザー |
| `SystemSetting` | システム設定 |

---

## 更新ルール

新しい機能を追加した場合は、以下の手順でこのファイルを更新してください：

1. 該当セクション（Kiosk/Admin/API）に行を追加
2. テスト列を `⬜` (未作成) → `✅` (テスト済) に更新
3. コミットメッセージに `docs: FEATURE_REGISTRY.md を更新` を含める
