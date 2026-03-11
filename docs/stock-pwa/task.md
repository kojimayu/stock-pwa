# 在庫監査システム構築

## 1. 準備・設計
- [x] Prismaスキーマの更新 (`InventoryCountItem` に `reason` カラムを追加)
- [x] データベースマイグレーションの実行

## 2. バックエンド実装 (Server Actions)
- [x] スポット棚卸登録用APIの実装 (`createSpotInventory`)
- [x] `receiveOrderItem` の `$transaction` 化
- [x] `updateInventoryItem` に `reason` パラメータ追加
- [x] 在庫差異分析レポート用データ取得APIの実装 (`getDiscrepancyReport`)
- [x] 在庫調整API (`adjustStock`) の廃止・置換対応

## 3. フロントエンド実装 (UI/UX)
- [x] スポット棚卸ダイアログの実装 (`inventory-list.tsx` 内)
- [x] 棚卸詳細画面に差異理由セレクトUIの追加 (`inventory-detail.tsx`)
- [x] 在庫管理画面の改修（「在庫調整」→ スポット棚卸に一本化）
- [x] 在庫差異分析レポート画面 (`admin/reports/discrepancy`) ✅ 完成

## 4. 納品記録リファクタリング（完了）
- [x] 材料発注: 入荷処理と納品書アップロードの分離
- [x] エアコン発注: 専用の納品記録ダイアログ新設
- [x] 入荷完了後でも納品記録を追加可能に

## 5. テスト・検証
- [x] TypeScriptビルドチェック — エラー0件
- [x] テスト全224件パス (21ファイル)
- [x] スポット棚卸 + 差異理由の結合テスト作成 (12テスト)
- [x] 在庫差異分析レポートのテスト作成 (4テスト)
- [ ] 実機での差異理由UI + レポート画面の動作確認
