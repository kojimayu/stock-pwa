# 互換品管理システム — 実装計画

## 概要

同じ規格で仕入先/メーカーが異なる互換品を管理する仕組みを追加する。
- **ユースケース**: 関東機材KS70 ⇔ 因幡電機LD70（互換品、売値同じ/仕入値違い）
- 通常は関東機材から仕入れるが、緊急時は因幡電機(中国電通経由)から購入

## 設計方針

**別商品＋互換グループID方式** を採用。

| 項目 | 方針 |
|---|---|
| 商品登録 | KS70とLD70は**別商品として個別登録** |
| 在庫管理 | 完全に独立（各商品ごとに在庫数） |
| 売値 | 同じ値を手動設定（互換グループでの自動共有は第2段階） |
| 仕入値 | 商品ごとに異なる → 粗利率がそれぞれ算出される |
| 紐づけ | `compatibleGroupId`（任意の文字列）で互換グループ化 |

> [!IMPORTANT]
> **第1段階はスキーマ追加＋UI表示のみ。** 売値の自動同期は第2段階で検討（必要な場合）。

---

## 影響分析

### 影響なし（変更不要）
| ファイル | 理由 |
|---|---|
| `lib/actions.ts`の`generateDraftOrders` | 商品ごとに独立判定のため影響なし |
| `lib/actions.ts`の`upsertProduct` | 新フィールドを保存するだけ（追加のみ） |
| `lib/return-actions.ts` | Product参照はIDベースで影響なし |
| `app/api/products/stock-check/route.ts` | 在庫チェックは個別商品単位 |
| Kioskの商品カード、カート、チェックアウト | Product.idベースで影響なし |
| テスト（既存） | nullableフィールド追加なのでmock更新不要 |

### 変更が必要
| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | Product に `compatibleGroupId String?` 追加 |
| `lib/actions.ts` (`upsertProduct`) | `compatibleGroupId` の保存に対応 |
| `lib/actions.ts` (`getProducts`) | 変更不要（全カラム取得済み） |
| `components/admin/product-list.tsx` | 互換マーク `⚡` 表示、互換品ツールチップ |
| `components/admin/product-dialog.tsx` | 互換グループ選択UI追加 |
| `app/(admin)/admin/products/page.tsx` | 互換グループ情報をProductListに渡す（変更不要：全カラム取得済み） |

---

## 実装ステップ

### Step 1: スキーマ変更
**ファイル**: `prisma/schema.prisma`

```prisma
model Product {
  // 既存フィールド...
  compatibleGroupId String?  // 互換品グループID（同じIDを持つ商品は互換品）
}
```

マイグレーション: `npx prisma db push`（nullableなのでデータ影響なし）

### Step 2: upsertProduct修正
**ファイル**: `lib/actions.ts`

`upsertProduct`関数に`compatibleGroupId`の保存を追加。
既存のフォームデータから取得し、create/updateに含める。

### Step 3: 商品編集ダイアログにUI追加
**ファイル**: `components/admin/product-dialog.tsx`

- 「互換グループ」テキスト入力フィールドを追加（任意入力）
- 既存の互換グループIDをサジェスト表示
- 入力例: `KS70系` や `LD70互換` など自由入力

### Step 4: 商品一覧に互換マーク表示
**ファイル**: `components/admin/product-list.tsx`

- `compatibleGroupId`を持つ商品にバッジ `⚡互換` を表示
- ツールチップまたはホバーで互換品一覧を表示
  例: `互換品: LD70B（因幡電機）原価110`

### Step 5: 自動発注画面で互換品情報表示（任意）
**ファイル**: `components/admin/order-list.tsx`

- 発注候補に互換品がある場合、「⚡互換品あり」の注記を表示
- 「緊急時は因幡電機からも調達可能」のような情報を提供

---

## テスト計画

### 新規テスト: `__tests__/actions/compatible-products.test.ts`

```
テストケース一覧:

1. 互換グループIDの保存テスト
   - compatibleGroupIdを指定して商品を作成・更新
   - null（未設定）で商品作成

2. 互換グループのフィルタリングテスト
   - 同じcompatibleGroupIdを持つ商品を正しくグループ化
   - compatibleGroupId未設定の商品はグループ外

3. 互換品UI表示ロジックテスト
   - 互換品がある商品 → バッジ表示あり
   - 互換品がない商品 → バッジ表示なし

4. 自動発注への影響なしテスト（回帰テスト）
   - 互換品が存在しても自動発注ロジックは個別商品単位で動作
   - 互換品の在庫を合算しない（独立管理の確認）
```

### 既存テスト: 回帰確認
- `npx vitest run` で全テスト（161件）がパスすることを確認

---

## 検証計画

1. マイグレーション後にDBバックアップ → 既存データ破損がないか確認
2. 商品編集ダイアログで互換グループIDを設定・保存・再表示
3. 商品一覧で互換マークが正しく表示されること
4. 自動発注候補が互換品の有無に影響されないこと
5. 全テスト（161件＋新規テスト）がパスすること

---

## リスク

| リスク | 対策 |
|---|---|
| マイグレーションでデータ喪失 | `db push`前にdevデータベースのバックアップ |
| 互換品の売値に差が出る | 第1段階では手動管理、将来的に同期機能を検討 |
| 互換グループIDの命名が自由すぎる | 既存グループIDをサジェスト表示してタイポ防止 |
