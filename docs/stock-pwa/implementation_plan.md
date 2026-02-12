# 検索ロジックの共通化

## ゴール
Kiosk、管理画面、検索ダイアログでバラバラに実装されている検索ロジック（全角・半角変換、大文字・小文字無視など）を統一し、ユーザーがどの画面でも同じ感覚で商品を検索できるようにする。

## User Review Required
- 特になし

## Proposed Changes

### Core Logic
#### [MODIFY] [lib/utils.ts](file:///f:/Antigravity/stock-pwa/lib/utils.ts)
- `normalizeForSearch(query: string): string` 関数を追加
  - 全角英数記号 → 半角英数記号
  - 大文字 → 小文字
  - 文字列内の空白削除（オプション）
  - ハイフンなどの記号の扱いを統一

### Components to Refactor
以下のコンポーネントで、個別の検索ロジックを削除し、`normalizeForSearch` を使用するように変更する。

#### [MODIFY] [components/admin/product-search-dialog.tsx](file:///f:/Antigravity/stock-pwa/components/admin/product-search-dialog.tsx)
- 検索入力時の正規化処理を置き換え

#### [MODIFY] [components/kiosk/product-list.tsx](file:///f:/Antigravity/stock-pwa/components/kiosk/product-list.tsx)
- クライアントサイドでのフィルタリングロジックを置き換え

#### [MODIFY] [app/(admin)/admin/products/page.tsx](file:///f:/Antigravity/stock-pwa/app/(admin)/admin/products/page.tsx)
- 管理画面の商品一覧フィルタリングを置き換え

## Verification Plan
### Automated Tests
- `normalizeForSearch` の単体テスト（Jest等がない場合は手動確認用スクリプト作成）
  - "ＡＢＣ" -> "abc"
  - "VxF-20" -> "vxf-20"
  - " 2分 3分 " -> "2分3分"

### Manual Verification
- Kioskの商品検索で「VVF」「vvf」「ＶＶＦ」がいずれもヒットすることを確認
- 管理画面の商品一覧で同様に確認
