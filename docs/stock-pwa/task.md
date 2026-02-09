# 調査タスク：Kioskログイン不具合と画面リセット問題

## 1. 現象の分析 (Root Cause Analysis)
- [x] ログイン時の「ぐるぐる（スピナー）」が止まらない原因の特定
- [x] 「別端末で初期画面を開くと、他端末もリセットされる」現象の調査
    - [x] **原因特定:** `dev.db` 更新によるNext.jsのホットリロード発生

## 2. サーバーサイドの調査
- [x] `lib/actions.ts` の `verifyVendorPin` 周辺のログ出力強化
- [x] `logOperation` の実装見直し
- [x] サーバーサイドでの「ログイン状態」のグローバル管理の有無を確認

## 3. クライアントサイドの調査
- [x] `app/layout.tsx` および `app/(kiosk)/layout.tsx` の調査
- [x] `IdleTimer.tsx` のリダイレクトトリガーを確認

## 4. 対策の提案 (一旦原因究明後に実施)
- [x] 特定された原因に基づく修正案の作成
- [x] 修正の実施と検証

# Kiosk UI改善 (Done)
- [x] Kiosk画面（商品一覧、カート、確認画面）から金額表示を削除・非表示にする

# 今後の実装タスク
- [ ] **再発防止策: マスタデータとUIの整備**
    - [x] `scripts/fix-product-units.js` の更新と実行（ビニールテープの単位「巻」化、IV線の単位「m」化）
    - [x] `QuantitySelectorDialog` の改善: 「箱（巻）」ボタンに入数を表示する
    - [x] `QuantitySelectorDialog` の改善: 箱選択時に「在庫からXX個減ります」と注釈を出す

- [ ] **誤入力修正機能（取引編集）の実装**
    - [ ] `implementation_plan.md` に基づくバックエンド実装 (Transaction更新、在庫自動調整)
    - [ ] 管理画面のUI実装 (取引履歴からの編集呼び出し)
