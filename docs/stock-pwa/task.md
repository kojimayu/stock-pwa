# タスク一覧（2026-03-09 更新）

## 1. 価格B一括修正（ワンタイムスクリプト）
- [x] DBバックアップ取得（prisma/ + Desktop 2箇所）
- [x] エアコン以外の全AUTO商品のpriceBを掛率から再計算（158件更新）
- [x] 修正結果の確認（価格Bズレ 0件）

## 2. ダッシュボードに在庫不一致申告バナー追加
- [x] `page.tsx`: getPendingDiscrepancies()追加、PENDING状態の不一致申告を取得・表示
- [x] 「すべて正常」条件に申告を追加
- [x] 動作確認（ブラウザで表示確認済み）

## 3. ドキュメント更新・コミット
- [x] CHANGELOG.md 更新
- [x] task.md 更新
- [ ] Git コミット

---

## 完了済み
### スポット棚卸 + 在庫不一致申告
- [x] `InventoryCount.type` フィールド追加（FULL/SPOT）
- [x] `StockDiscrepancy` モデル追加
- [x] サーバーアクション実装
- [x] Kioskでの不一致申告送信
- [x] 全テスト合格（205/205）
