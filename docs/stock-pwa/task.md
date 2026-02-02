# Tasks

## 現在のタスク (2026-02-02)

- [x] 全ページにホーム戻るボタンを追加 <!-- id: 50 --> (サイドバーに既存)
- [x] 利益分析ページをサイドバーから削除（404エラー対応）<!-- id: 51 -->
- [x] エアコン持出し履歴に検索機能追加 <!-- id: 52 -->
    - [x] 業者名フィルター
    - [x] 日付フィルター
    - [x] 管理Noフィルター
- [x] 業者ごとのメール金額表示設定 <!-- id: 53 -->
- [x] サイドバーをカテゴリ分け <!-- id: 55 -->
- [x] 取引履歴に検索機能追加 <!-- id: 56 -->
- [x] エアコン在庫管理: 発注サフィックスの入力制限緩和（2文字→5文字、「25S」対応） <!-- id: 74 -->
- [x] **Kiosk UI/UX改善** <!-- id: 80 -->
    - [x] 材料画面からエアコン画面への遷移を追加/修正 <!-- id: 81 -->
    - [x] トースト通知の位置を調整（ボタン被り回避） <!-- id: 82 -->
    - [x] エアコン持出し履歴画面の実装 <!-- id: 83 -->
    - [x] エアコン持出し履歴の修正機能 <!-- id: 84 -->
    - [x] ベンダー名表示位置の統一 <!-- id: 85 -->
    - [x] エアコン戻しアイテムの履歴表示ロジック改善（グレーアウト表示） <!-- id: 86 -->
- [x] エアコン発注管理機能 <!-- id: 57 -->
    - [x] エアコン商品マスタ（4品目）
    - [x] 在庫管理ページ
    - [x] 発注・入荷管理ページ
    - [x] 年度サフィックス設定
    - [x] 持出し時の自動在庫減算
    - [x] 戻し機能（在庫復元）
    - [x] ダッシュボードに統合
    - [x] 商品ごとのサフィックス個別設定（RAS-AJ22はN、RAS-AJ28はM等）
- [x] 持出し画面のUI/UX改善 <!-- id: 54 -->
    - [x] タブレット向け2カラムレイアウト（検索・情報｜リスト・操作）
    - [x] 削除ボタン・確定ボタンの視認性向上
- [x] 材料の戻し機能 <!-- id: 58 -->
    - [x] Transactionモデルにフラグ追加
    - [x] 「戻す」ボタン実装（在庫自動復元）
    - [x] **一部戻し（数量訂正）への対応**（ダイアログ実装）
- [x] 商品選択画面の改善（リスト化・人気順・2段階カテゴリ） <!-- id: 60 -->
- [x] UIレイアウト最適化（サイドバー・手入力改善） <!-- id: 61 -->
- [x] 3カラムレイアウト＆手入力ボタン配置調整 <!-- id: 62 -->
- [x] UIブラッシュアップ（金額非表示・ボタン調整） <!-- id: 63 -->
- [x] PWAテーマカラー設定復元 <!-- id: 64 -->
- [x] 棚卸画面のモバイル対応 <!-- id: 65 -->
- [x] 商品選択画面のスクロール修正＆型式表示 <!-- id: 66 -->
- [x] QRコード認証（ログイン＆管理） <!-- id: 67 -->
- [ ] **緊急修正: 原価保護と在庫反映** <!-- id: 70 -->
    - [ ] 商品管理: 原価(priceB)が消えないように保護・ロックする <!-- id: 71 -->
    - [ ] 商品管理: 在庫数変更が反映されない問題を修正 <!-- id: 72 -->
    - [ ] Kiosk: 出庫完了後の画面遷移時のエラー調査 <!-- id: 73 -->









---

## 完了したタスク

- [x] Refine Air Conditioner Checkout UI
    - [x] Add Preset Buttons for 4 main models (Hitachi AJ Series) <!-- id: 20 -->
    - [x] Implement "Free Input" toggle <!-- id: 21 -->
    - [x] Update Placeholders <!-- id: 22 -->
- [x] Implement Dynamic Access Vendor Linking
    - [x] Update Schema: Add `accessCompanyName` to `Vendor` <!-- id: 30 -->
    - [x] Create API: `GET /api/access/vendors` (Fetch list from Access via PowerShell) <!-- id: 31 -->
    - [x] Update Admin Vendor UI:
        - [x] Add "Link Access Company" dropdown in Vendor Edit/Create dialog <!-- id: 32 -->
        - [x] Add "Sync Access Vendors" button to populate options (Auto-fetch implemented) <!-- id: 33 -->
    - [x] Update `lib/access-control.ts` / API to use dynamic DB field instead of dynamic map <!-- id: 34 -->
- [x] Support Multi-unit Checkout
    - [x] Update API to accept item array <!-- id: 40 -->
    - [x] Update Kiosk UI for item list management <!-- id: 41 -->
- [x] Verification
    - [x] Verify fetching vendor list from Access <!-- id: 35 -->
    - [x] Verify linking a Web Vendor to an Access Vendor <!-- id: 36 -->
    - [x] Verify Access Search uses the linked name <!-- id: 37 -->
- [x] Improve Admin Vendor UI (Combobox)
- [x] Implement Aircon Logs Page (/admin/aircon-logs)
