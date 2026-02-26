# 複合改修計画

## 背景

1. データ安全対策が不十分（save_and_backup実行後にenv汚染が残る）
2. Kiosk持出し履歴・管理画面の戻し処理に品番（code）が表示されていない
3. エアコン発注の入荷処理が拠点を考慮せず全量をstockに加算している
4. 納品先拠点と業者の紐付けがない
5. 発注管理画面で業者（拠点）の検索ができない

---

## A. 安全対策の強化

### A1. `save_and_backup.md` の環境変数汚染修正

**原因**: テスト実行時に `$env:DATABASE_URL="file:./prisma/test-vitest.db"` を設定するが、**リセットしていない**。

#### [MODIFY] [save_and_backup.md](file:///f:/Antigravity/stock-pwa/.agent/workflows/save_and_backup.md)
- Step 1のテスト実行コマンドを1行にまとめ、**末尾に `Remove-Item Env:DATABASE_URL`** を追加
- Step 1.5で確認を行う

### A2. コード変更前の自動バックアップ

#### [NEW] `.agent/workflows/pre-change-backup.md`
- コード変更前に dev.db を2箇所バックアップ + `check_db.mjs`でデータ確認
- 件数0なら中止

---

## B. 品番（code）表示の追加

### B1. Kiosk持出し履歴

#### [MODIFY] [history-list.tsx](file:///f:/Antigravity/stock-pwa/components/kiosk/history-list.tsx)
- 各商品名の前に品番を薄いグレーで表示

### B2. 管理画面の部材戻し処理

#### [MODIFY] [transaction-list.tsx](file:///f:/Antigravity/stock-pwa/components/admin/transaction-list.tsx)
- items JSON内の各商品表示に品番を追加

---

## C. 業者と拠点の紐付け

### C1. スキーマ変更

#### [MODIFY] [schema.prisma](file:///f:/Antigravity/stock-pwa/prisma/schema.prisma)

Vendorモデルに `deliveryLocationId` を追加（1業者=1拠点）:

```diff
model Vendor {
  id                 Int                 @id @default(autoincrement())
  name               String
+ deliveryLocationId Int?                // 所属する納品先拠点
+ deliveryLocation   DeliveryLocation?   @relation(fields: [deliveryLocationId], references: [id])
  ...
}

model DeliveryLocation {
  ...
+ vendors    Vendor[]
}
```

### C2. 業者管理画面に拠点選択追加

#### [MODIFY] 業者管理画面
- 業者の編集時に拠点をドロップダウンで選択可能に

---

## D. エアコン発注の拠点別入荷管理

### D1. 「プラスカンパニー本社」の判定方法

2つの方法があります：

| 方法 | メリット | デメリット |
|------|---------|----------|
| **名前判定** (`name.includes("プラス")`) | 実装が簡単。スキーマ変更不要 | 拠点名を変更すると壊れる。将来拠点が増えたら対応困難 |
| **フラグ** (`isMainWarehouse: Boolean`) | 拠点名に依存しない。将来の拡張性が高い。管理画面でON/OFF可能 | スキーマ変更が必要（カラム1つ追加） |

> [!IMPORTANT]
> **推奨: フラグ方式**（`isMainWarehouse`）
> 拠点名が「プラスカンパニー本社」→「プラスカンパニー 滋賀本社」に変わっても壊れない。
> 将来複数の主倉庫が必要になった場合にも対応しやすい。

```diff
model DeliveryLocation {
  id              Int           @id @default(autoincrement())
  name            String
  address         String?
  isActive        Boolean       @default(true)
+ isMainWarehouse Boolean       @default(false)  // 在庫管理の主拠点
  createdAt       DateTime      @default(now())
  orders          AirconOrder[]
+ vendors         Vendor[]
}
```

### D2. 入荷処理の修正

#### [MODIFY] [aircon-actions.ts](file:///f:/Antigravity/stock-pwa/lib/aircon-actions.ts) → `receiveAirconOrderItem()`

- 発注の`deliveryLocation.isMainWarehouse`を確認
- `true` → stockを加算（現行通り）
- `false` → 入荷記録（receivedQuantity更新・ステータス変更）のみ、**stockは加算しない**

### D3. 発注管理画面に業者（拠点）検索追加

#### [MODIFY] [aircon-orders/page.tsx](file:///f:/Antigravity/stock-pwa/app/(admin)/admin/aircon-orders/page.tsx)
- 発注一覧にフィルタ機能を追加（拠点・業者名で絞り込み）
- 新規発注時に拠点選択→その拠点に紐付く業者を自動表示

---

## E. 将来拡張への備考

今回は実装しないが、設計時に考慮しておく項目：

- **拠点別在庫管理**: `AirconProduct.stock` を `AirconProductStock(productId, locationId, quantity)` 中間テーブルに分離
- **拠点別出庫管理**: エアコン持出し時にどの拠点から出庫したか記録
- **業者⇔拠点の多対多対応**: 中間テーブル `VendorDeliveryLocation` に変更

---

## 実装順序

1. **A. 安全対策** — 最優先（データ消失防止）
2. **B. 品番表示** — 影響範囲小、独立して実装可能
3. **C. 業者-拠点紐付け** — D の前提条件
4. **D. 拠点別入荷管理** — C の後に実装

---

## 検証計画

### 自動テスト
- `receiveAirconOrderItem` に拠点判定のテストケース追加（本社入荷→stock加算、他拠点→加算なし）
- save_and_backup後にenv汚染が残らないことの確認

### 手動確認
- Kiosk画面で品番が表示されること
- 管理画面の戻し処理で品番が表示されること
- 本社以外の拠点への入荷で在庫が増えないこと
- 業者管理画面で拠点を選択・保存できること
