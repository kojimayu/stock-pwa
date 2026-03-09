# スポット棚卸 + 業者在庫不一致申告 実装計画

## 背景

現在の棚卸機能は「一斉棚卸」のみ（全商品対象）。
特定の商品だけを素早くカウントする「スポット棚卸」+ 業者がKiosk画面から「在庫が合わない」と申告できる機能を追加。

## 設計方針

### フロー概要

```
業者(Kiosk) → 持出し時「在庫が合わない」申告 → DBに記録
                                                    ↓
管理者(Admin) → 「スポット棚卸」開始 → 申告済み商品が自動提案 + 手動選択
                                        ↓
                                    実数入力 → 確定 → 在庫修正
```

### DB設計
- `InventoryCount.type`: `FULL` / `SPOT` を追加
- **新規テーブル `StockDiscrepancy`**: 業者からの在庫不一致申告を記録

---

## Proposed Changes

### 1. スキーマ変更

#### [MODIFY] [schema.prisma](file:///f:/Antigravity/stock-pwa/prisma/schema.prisma)

```prisma
// InventoryCount に type 追加
model InventoryCount {
  // ... 既存フィールド
  type      String    @default("FULL")  // FULL / SPOT
}

// 新規: 業者からの在庫不一致申告
model StockDiscrepancy {
  id            Int       @id @default(autoincrement())
  productId     Int
  vendorId      Int
  vendorUserId  Int?
  reportedStock Int       // 業者が確認した実際の数
  systemStock   Int       // 申告時のシステム在庫
  note          String?   // メモ（任意）
  status        String    @default("PENDING") // PENDING / RESOLVED
  resolvedAt    DateTime?
  createdAt     DateTime  @default(now())
  product       Product   @relation(fields: [productId], references: [id])
  vendor        Vendor    @relation(fields: [vendorId], references: [id])
}
```

→ マイグレーション実行

---

### 2. サーバーアクション

#### [MODIFY] [actions.ts](file:///f:/Antigravity/stock-pwa/lib/actions.ts)

**新規追加:**
- `reportStockDiscrepancy(productId, vendorId, vendorUserId, reportedStock, note?)` — 業者が不一致を申告
- `getStockDiscrepancies(status?)` — 未解決の申告一覧取得
- `createSpotInventory(productIds: number[], note?)` — スポット棚卸開始（選択商品のみ）
- `resolveDiscrepancy(id)` — 棚卸確定時に自動解決

**変更:**
- `createInventoryCount` → `type: 'FULL'` を設定
- `checkActiveInventory` → SPOT/FULL両方チェック

---

### 3. Kiosk UI（業者の申告画面）

#### [MODIFY] チェックアウト完了後 or 在庫確認画面

持出し時の在庫チェック画面（`requireStockCheck=true` の商品）に「在庫が合わない」ボタンを追加。
タップ → 実際の数を入力 → 申告送信。

---

### 4. Admin UI（管理画面）

#### [MODIFY] [inventory/page.tsx](file:///f:/Antigravity/stock-pwa/app/(admin)/admin/inventory/page.tsx)
- 「スポット棚卸」ボタン追加
- 商品選択ダイアログ: **未解決の申告がある商品** を自動チェック + 手動追加
- 棚卸一覧に type バッジ表示

#### [MODIFY] ダッシュボード or InventoryページHEAD
- 未解決の不一致申告数をバッジ表示（⚠ 3件の在庫不一致報告）

---

### 5. テスト

#### [MODIFY] [stock.test.ts](file:///f:/Antigravity/stock-pwa/__tests__/actions/stock.test.ts)
- `createSpotInventory` テスト
- `reportStockDiscrepancy` テスト
- 棚卸確定時に申告が自動解決されるテスト

---

## Verification Plan

### Automated Tests
```bash
npx vitest run __tests__/actions/stock.test.ts
npx vitest run
```

### Manual
- Kiosk画面から在庫不一致を申告
- 管理画面で申告情報を確認→スポット棚卸に含めて確定
- ダッシュボードに申告バッジが表示されること
