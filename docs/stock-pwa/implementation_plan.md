# JST日時整合性の監査結果 + 実装計画

## 概要
`announcement-modal.tsx` の UTC 日付バグを起点に、プロジェクト全体の日時処理を監査。

## 調査結果

### ✅ 安全（修正不要）

| 箇所 | パターン | 理由 |
|------|----------|------|
| `proxy-shop-content.tsx` | `pickupDate + "T00:00:00+09:00"` | 既にJST修正済み |
| `aircon/transaction/route.ts` | `transactionDate + "T00:00:00+09:00"` | 既にJST修正済み |
| `proxy-input.test.ts` | テストでJST検証済み | テスト3件あり |
| `page.tsx (admin)` | `new Date(now.getFullYear(), now.getMonth(), now.getDate())` | **サーバー側**でOS TZ=JST依存。ローカル実行なので現状安全 |
| `products/page.tsx` | `new Date(now.getFullYear(), now.getMonth(), 1)` | 同上（月初計算） |
| `aircon-orders/page.tsx` | `todayStart/tomorrowStart` 比較 | 同上 |
| `aircon-actions.ts:325` | `generateOrderNumber()` — `getFullYear/getMonth/getDate` | 発注番号の日付部分。OS TZ=JST依存。ローカルで安全 |
| `shipping-utils.ts` | `getFullYear/getMonth/getDate` | 出荷日計算。OS TZ=JST依存 |
| `order-email/route.ts` | `toLocaleDateString("ja-JP")` | 表示用のみ。ロジックに影響なし |
| `inventory-detail.tsx` | `new Date().toISOString()` checkedAt | UIタイムスタンプ。表示時にja-JPフォーマットされる |
| `transaction-list.tsx` | `toISOString().split("T")[0]` CSVファイル名 | ファイル名のみ。1日ずれても実害なし |
| `product-export-button.tsx` | 同上 | 同上 |
| `aircon-logs/page.tsx` | 同上 | 同上 |

### ⚠️ 修正済み

| 箇所 | 問題 | 対応 |
|------|------|------|
| `announcement-modal.tsx` | `toISOString().slice(0,10)` で UTC 日付 → 朝9時前に前日フラグが残る | `getJSTDateString()` に修正済み |

### 🟡 低リスクだが改善推奨

| 箇所 | パターン | 影響 |
|------|----------|------|
| `proxy-shop-content.tsx:31` | `new Date().toISOString().split('T')[0]` で初期日付 | date inputのデフォルト値。朝9時前は前日の日付が入る。ユーザーが確認するので実害は小さいが混乱の元 |
| `proxy-aircon-form.tsx:39` | 同上 | 同上 |
| `aircon-orders/page.tsx:283` | `toISOString().split('T')[0]` 初期値 | 入荷日のデフォルト。同上 |
| `order-detail.tsx:48` | 同上 | 同上 |

## 提案

### 1. `lib/date-utils.ts` にJST日付ユーティリティを集約（NEW）
```typescript
/** JST (UTC+9) の YYYY-MM-DD を返す */
export function getJSTDateString(date?: Date): string {
  const d = date ?? new Date();
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
```

### 2. 各ファイルの修正
- `announcement-modal.tsx`: 独自 `getJSTDateString` → `lib/date-utils.ts` からimport
- `proxy-shop-content.tsx`: 初期値を `getJSTDateString()` に変更
- `proxy-aircon-form.tsx`: 同上
- `order-detail.tsx`: 同上
- `aircon-orders/page.tsx:283`: 同上

### 3. テスト追加
- `__tests__/utils/date-utils.test.ts` を新規作成
  - `getJSTDateString` が正しくJST日付を返すことを検証
  - UTC 23:00（JST翌日8:00）でも正しい日付を返すか
  - UTC 15:00（JST翌日0:00 = 日付変わり目）の境界テスト

### 4. サーバーTZ依存の注記
サーバー側の `new Date(getFullYear, getMonth, getDate)` はOS TZに依存。
現在はローカルWindows（TZ=JST）で実行中なので問題ないが、
**クラウド移行時はサーバー起動時に `TZ=Asia/Tokyo` を設定する必要あり**。

## 修正不要と判断した理由
- サーバー側のDate操作（`getFullYear` 等）: Node.jsはOS TZを使用。現環境はWindows(JST)なのでOK
- `toLocaleDateString("ja-JP")`: 表示用のみでロジックには使わない
- CSVファイル名の日付: 1日ずれても実害なし
