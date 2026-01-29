# タスク

- [ ] 要件定義・設計
    - [x] Access連携の調査（同期不要・直接接続） <!-- id: 0 -->
    - [x] UIフローの設計（ログイン -> モード選択 -> 各画面） <!-- id: 1 -->
    - [x] データモデル定義（Prisma） <!-- id: 2 -->
- [ ] 実装
    - [ ] パッケージ導入 `npm install node-adodb` <!-- id: 10 -->
    - [ ] データベース更新 (`schema.prisma` / `AirConditionerLog`追加) <!-- id: 4 -->
    - [ ] API作成 `app/api/access/route.ts` (Access接続) <!-- id: 5 -->
    - [ ] フロントエンド実装
        - [ ] モード選択画面作成 `app/(kiosk)/mode-select/page.tsx` <!-- id: 6 -->
        - [ ] ログイン後の遷移変更 `app/(kiosk)/page.tsx` <!-- id: 14 -->
        - [ ] エアコン持出し画面作成 `app/(kiosk)/aircon/page.tsx` <!-- id: 11 -->
    - [ ] 動作検証 <!-- id: 8 -->
