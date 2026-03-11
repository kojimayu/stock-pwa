# 在庫監査システム構築

## 1. 準備・設計
- [ ] Prismaスキーマの更新 (`InventoryCountItem` に `reason` カラムを追加)
- [ ] データベースマイグレーションの実行

## 2. バックエンド実装 (Server Actions)
- [ ] スポット棚卸登録用APIの実装 (`createSpotInventory`)
  - 複数商品の実在庫同時更新と `InventoryCount`, `InventoryCountItem`, `InventoryLog` のトランザクション記録
- [ ] `receiveOrderItem` の `$transaction` 化（入荷時の在庫不整合バグ修正）
- [ ] 在庫調整API (`adjustStock`) の廃止・置換対応
- [ ] 在庫差異分析レポート用データ取得APIの実装 (`getDiscrepancyReport`)

## 3. フロントエンド実装 (UI/UX)
- [ ] 在庫管理画面の改修
  - 既存の「在庫調整」機能の削除
  - 「スポット棚卸（監査）」ボタンと、商品選択UIの実装
- [ ] スポット棚卸入力モーダル (`spot-inventory-dialog.tsx`) の実装
  - 実在庫の入力、差異の自動計算、差異理由（数え間違い/記録漏れ/破損/不明）の選択UI
- [ ] 在庫差異分析レポート画面 (`app/admin/reports/discrepancy/page.tsx`) の新規作成
  - 差異ランキング（不足TOP/過剰TOP）の表示
  - 差異推移グラフ（商品別の時系列）の表示
  - カテゴリ別ロス金額と理由別集計のサマリー表示

## 4. テスト・検証
- [ ] スポット棚卸機能の結合テスト作成
- [ ] 実機（テスト環境）での動作確認
