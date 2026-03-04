# 在庫確認強化 3機能セット — 実装計画

## 概要
業者のログイン〜持出し完了のフローに3つの在庫確認機能を組み込む。

```
業者ログイン → ①お知らせモーダル → モード選択 → 商品選択 → ②残数チェック → 確定 → ③簡易棚卸
```

## 見積もり

| # | 機能 | 作業量 | 概算時間 |
|---|------|:---:|:---:|
| ① | ログイン後お知らせモーダル | DB+Admin UI+Kioskモーダル | 45分 |
| ② | 持出し確定時の残数チェック | DBフラグ+Admin toggle+checkout修正 | 30分 |
| ③ | 持出し後の簡易棚卸 | 既存`StockVerificationDialog`を拡張 | 20分 |
| | テスト+コミット | | 15分 |
| | **合計** | | **約2時間** |

> [!NOTE]
> ②③は既存コードの基盤が整っているため、想定より軽い。

---

## Proposed Changes

### ① ログイン後お知らせモーダル（必読）

#### [MODIFY] [schema.prisma](file:///f:/Antigravity/stock-pwa/prisma/schema.prisma)
- `SystemConfig`モデルを新設（key-value型）
  ```prisma
  model SystemConfig {
    key       String   @id
    value     String
    updatedAt DateTime @updatedAt
  }
  ```
- キー `kiosk_announcement` に文面を保存

#### [NEW] [announcement-settings.tsx](file:///f:/Antigravity/stock-pwa/app/(admin)/admin/settings/announcement-settings.tsx)
- 管理画面にお知らせ設定ページ（テキストエリア+保存ボタン）
- 空文字にすればお知らせ無効

#### [NEW] [api/config/route.ts](file:///f:/Antigravity/stock-pwa/app/api/config/route.ts)
- GET: `kiosk_announcement`の値を返すAPI（既存であれば流用）

#### [MODIFY] [page.tsx (Kioskログイン)](file:///f:/Antigravity/stock-pwa/app/(kiosk)/page.tsx)
- ログイン成功後、`kiosk_announcement`を取得
- 文面があればモーダル表示 → 「確認しました」押下で`mode-select`へ遷移
- モーダルは全画面、閉じるボタンなし、スクロール可、大きめフォント

---

### ② 持出し確定時の残数チェック（必須）

#### [MODIFY] [schema.prisma](file:///f:/Antigravity/stock-pwa/prisma/schema.prisma)
- `Product`モデルに `requireStockCheck Boolean @default(false)` 追加

#### [MODIFY] [product-dialog.tsx](file:///f:/Antigravity/stock-pwa/components/admin/product-dialog.tsx)
- 商品編集ダイアログに「在庫チェック必須」トグル追加

#### [MODIFY] [checkout page](file:///f:/Antigravity/stock-pwa/app/(kiosk)/shop/checkout/page.tsx)
- カートの各商品に対し、`requireStockCheck=true`の商品について：
  - 「現在庫: XX個 → 持出し後: YY個」を表示
  - ☑「残数を確認しました」チェックボックスを追加
  - 全チェック完了まで「出庫を確定する」ボタンを無効化

---

### ③ 持出し後の簡易棚卸

#### [MODIFY] [stock-verification-dialog.tsx](file:///f:/Antigravity/stock-pwa/components/kiosk/stock-verification-dialog.tsx)
- 既存ダイアログの「在庫が合っている/合っていない」フローを活用
- 現在は`expectedStock`を表示するだけ → 変更なしで既に③の機能を持っている

> [!NOTE]
> 既存の`StockVerificationDialog`と`CheckoutButton`が③を実質的に実現済み。
> `createTransaction`が`stockInfo`を返しており、チェックアウト後にダイアログが表示される。
> 追加作業: `createTransaction`のstockInfo対象を`requireStockCheck=true`の商品限定にするか、全商品にするかの調整のみ。

---

## 検討事項

> [!IMPORTANT]
> 1. **お知らせの表示頻度**: セッションごと（ログインするたび毎回）でよいか？
>    - 提案: セッションごと（ログイン時に毎回表示）
> 2. **管理画面の配置**: お知らせ設定はどこに置くか？
>    - 提案: `/admin/settings` に新しいページを作成、またはダッシュボードに設定パネル
> 3. **既存③のカバー範囲**: 持出し後の在庫確認ダイアログは既に全商品で出ているが、`requireStockCheck`商品のみに絞るか？

---

## Verification Plan

### Automated Tests
- `npx vitest run` — 全テスト通過確認
- SystemConfig CRUD テスト追加
- requireStockCheck フラグのテスト追加

### Manual Verification
- Kioskログイン → お知らせモーダル表示確認
- お知らせ文を空にして → モーダル非表示確認
- requireStockCheck商品を含むカートで残数チェック表示確認
- チェック未完了で確定ボタン無効確認
- 持出し後の簡易棚卸ダイアログ表示確認
