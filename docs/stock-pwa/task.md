# タスク一覧（2026-03-09 更新）

## スポット棚卸 + 在庫不一致申告

### スキーマ変更
- [x] `InventoryCount.type` フィールド追加（FULL/SPOT）
- [x] `StockDiscrepancy` モデル追加
- [x] `prisma db push` 実行・データ件数確認
- [x] テストDB同期
- [x] `setup.ts` クリーンアップ追加

### サーバーアクション
- [/] `createSpotInventory(productIds, note?)` — スポット棚卸開始
- [ ] `reportStockDiscrepancy(...)` — 業者から不一致申告
- [ ] `getStockDiscrepancies(status?)` — 申告一覧取得
- [ ] `resolveDiscrepancy(id)` — 申告を解決済みに

### Admin UI
- [ ] 棚卸一覧ページ: スポット棚卸ボタン + 商品選択ダイアログ
- [ ] 棚卸一覧: type バッジ表示
- [ ] ダッシュボード: 未解決申告バッジ

### Kiosk UI
- [ ] 在庫チェック画面に「在庫が合わない」ボタン
- [ ] 実数入力→申告送信

### テスト
- [ ] `createSpotInventory` テスト
- [ ] `reportStockDiscrepancy` テスト
- [ ] 全テストリグレッション確認

### コミット・デプロイ
- [ ] CHANGELOG更新
- [ ] コミット＆push

---

## 前回完了
- [x] MANUAL価格テスト修正
- [x] CollapsiblePanelテスト修正
- [x] 発注一覧の行クリック修正
- [x] 送料チェック機能（UI統合済み）
