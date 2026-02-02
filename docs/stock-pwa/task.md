# Tasks

## 現在のタスク (2026-02-02)

- [x] 全ページにホーム戻るボタンを追加 <!-- id: 50 --> (サイドバーに既存)
- [x] 利益分析ページをサイドバーから削除（404エラー対応）<!-- id: 51 -->
- [x] エアコン持出し履歴に検索機能追加 <!-- id: 52 -->
    - [x] 業者名フィルター
    - [x] 日付フィルター
- [/] 業者ごとのメール金額表示設定 <!-- id: 53 --> (Prisma generate完了、動作確認待ち)
- [ ] 持出し画面の商品検索UX向上（将来）<!-- id: 54 -->
- [x] サイドバーをカテゴリ分け <!-- id: 55 -->
- [x] 取引履歴に検索機能追加 <!-- id: 56 -->


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
