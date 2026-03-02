# 棚卸の複数人同時作業対応

2人で棚卸する際、相手がどの項目を完了したか分からずダブりが発生する問題を解消。
項目ごとに「✅ OK」ボタンを追加し、確認済み状態をリアルタイム同期する。

## User Review Required

> [!IMPORTANT]
> **DBスキーマ変更あり**: `InventoryCountItem`と`AirconInventoryCountItem`に2カラム追加（`checkedBy`, `checkedAt`）。`prisma db push`で適用。既存データに影響なし（NULL許容）。

> [!WARNING]
> **リアルタイム同期**: Server-Sent Events (SSE) またはポーリングのどちらを採用するか。SSEは接続管理が複雑、ポーリング(5秒間隔)はシンプルで十分実用的。**ポーリング方式を推奨**。

## Proposed Changes

### DBスキーマ

#### [MODIFY] [schema.prisma](file:///f:/Antigravity/stock-pwa/prisma/schema.prisma)
- `InventoryCountItem` に `checkedBy String?` と `checkedAt DateTime?` を追加
- `AirconInventoryCountItem` に同様のフィールドを追加

---

### サーバーアクション

#### [MODIFY] [actions.ts](file:///f:/Antigravity/stock-pwa/lib/actions.ts)
- `checkInventoryItem(itemId, checkedBy)` — OKボタン押下時に確認者と日時を記録
- `uncheckInventoryItem(itemId)` — OK取消し
- `getInventoryCount` のレスポンスに `checkedBy`/`checkedAt` を含める

#### [MODIFY] [aircon-actions.ts](file:///f:/Antigravity/stock-pwa/lib/aircon-actions.ts)
- エアコン棚卸にも同様の `checkAirconInventoryItem` / `uncheckAirconInventoryItem` を追加

---

### UI（材料棚卸）

#### [MODIFY] [inventory-detail.tsx](file:///f:/Antigravity/stock-pwa/components/admin/inventory-detail.tsx)
- 各商品行に「✅ OK」ボタン追加（数量入力の右側）
- 確認済み: 緑背景 + 確認者名 + タイムスタンプ表示
- 未確認: 白/黄色背景のまま
- 進捗バーを「確認OK済み件数 / 全件」に変更
- **5秒ポーリング**でデータ再取得 → 他ユーザーのOK状態がリアルタイム反映

---

### UI（エアコン棚卸）

#### [MODIFY] [aircon-inventory/page.tsx](file:///f:/Antigravity/stock-pwa/app/(admin)/admin/aircon-inventory/page.tsx)
- 材料と同様に「✅ OK」ボタン + 確認者表示 + ポーリング同期を追加

---

## Verification Plan

### Automated Tests
- `npx vitest run` — 既存テスト通過確認
- `npm run build` — ビルド成功確認

### Manual Verification
- 2つのブラウザタブを開き、同じ棚卸セッションを表示
- 片方でOKボタン押下 → もう片方に5秒以内に反映されることを確認
- 確定時に全件OKでなくても確定可能（OKは任意）
