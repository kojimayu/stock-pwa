# 価格B一括修正 + 在庫不一致ダッシュボード表示

## 調査結果

### 価格Bの手動表示問題 — 根本原因の特定

**「手動設定中」は DB の `priceMode` フィールドではなく、UIのリアルタイム計算で判定されている。**

- `ProductDialog` L178-179: `isManualPriceB = cost > 0 && currentPriceB !== ceil(cost * markupRateB)`
- `getPricingReport` L850-851: `isPriceBManual: expectedB !== null && priceB !== expectedB`

つまり **`priceMode=AUTO` でも priceB が掛率計算値と合わなければ手動表示** になる。

#### データ実態

| 項目 | 件数 |
|------|------|
| priceB 掛率不一致（UIで手動表示） | **162件** |
| うち `priceMode=AUTO` | **158件** |
| うち `priceMode=MANUAL`（エアコン） | **4件** |
| priceA 掛率不一致 | **4件**（エアコンのみ） |
| priceB 正常一致 | 21件 |

| カテゴリ | priceB不一致 | 掛率B |
|---------|-------------|-------|
| 化粧カバー | 111件 | ×1.1 |
| 配管資材 | 34件 | ×1.1 |
| 架台・ブロック | 11件 | ×1.1 |
| 電線・コンセント | 2件 | ×1.1 |
| エアコン | 4件 | ×1.3 |

> [!IMPORTANT]
> **原因**: 掛率システム導入時に「一括適用」を priceA のみに実行し、priceB は再計算されなかった。既存の `recalculateCategoryPrices` 関数は priceA/B **両方** を更新するので、全カテゴリで実行すれば修正できる。

### 価格設定画面の問題点

1. **価格設定(PricingDashboard)に手動バッジがない**
   - 商品管理では「手動設定中」バッジが表示されるが、価格設定テーブルの「モード」列は DB の `priceMode` のみ表示
   - priceB が掛率不一致でも AUTO と表示される → 矛盾

2. **価格変更が2箇所からできる問題**
   - 商品管理: ProductDialog で個別に priceA/B を編集
   - 価格設定: PricingDashboard でインライン編集
   - → 整合性リスクあり。ただし今回は修正範囲外とする（大きな設計変更が必要）

---

## Proposed Changes

### 1. priceB 一括修正

「一括適用」ボタン（`recalculateCategoryPrices`）をエアコン以外の全カテゴリで実行する。

- **対象**: `priceMode=AUTO` かつ `cost > 0` の商品（エアコンはMANUALなので除外される）
- **影響**: 158件の priceB が掛率計算値に修正される
- **安全性**: priceTier=B の業者は0件なので、実際の取引に影響なし

> [!WARNING]
> 実行前にDBバックアップを取得する（`/save_and_backup` ワークフロー）

---

### 2. ダッシュボードに在庫不一致申告バナー追加

#### [MODIFY] [page.tsx](file:///f:/Antigravity/stock-pwa/app/(admin)/admin/page.tsx)

1. `getPendingDiscrepancies()` データ取得関数を追加
2. PENDING状態の不一致申告数をアラートバナーで表示（オレンジ系）
3. 「すべて正常」判定条件に不一致申告を追加

---

## Verification Plan

### Automated Tests
```bash
npx vitest run
```

### Manual
- 一括修正前後で priceB の値を比較確認
- 価格設定画面の「価格Bズレ」フィルターが 0 件になることを確認
- 商品管理で priceB の「手動設定中」バッジが消えることを確認
- ダッシュボードにアクセスし、不一致申告のバナー表示を確認
