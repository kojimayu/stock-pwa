# エアコン予備持ち出し（自社倉庫在庫）実装計画

## 目標
管理No（案件）が決まっていないエアコンを「予備（自社在庫）」として持ち出す機能を追加する。
これにより、現場判断での予備確保や、自社倉庫への在庫移動をシステム上で記録可能にする。

## 変更内容

### 1. Kiosk画面 (UI)
#### [MODIFY] [ac-checkout.tsx](file:///f:/Antigravity/stock-pwa/components/kiosk/ac-checkout.tsx)
- 「管理No（案件No）」入力欄の近くに、「予備（自社在庫）」ボタンを追加。
- **挙動**:
    - ONにすると、管理No入力欄が非表示（または無効化）になり、システム内部で自動的に `INTERNAL` という文字列がセットされる。
    - 画面上に「自社倉庫の予備として持ち出します」という注釈を表示。

### 2. バックエンド (Server Actions)
#### [MODIFY] [actions.ts](file:///f:/Antigravity/stock-pwa/lib/actions.ts)
- `createAirConditionerLog` 関数内のバリデーションを修正。
    - `managementNo` が `INTERNAL` の場合も正常な持ち出しとして処理する。
    - （現状のロジックでも `String` なので通るはずだが、念のため特別なバリデーションがあれば緩和する）

### 3. 管理画面 (Admin)
#### [MODIFY] [aircon-logs/page.tsx](file:///f:/Antigravity/stock-pwa/app/(admin)/admin/aircon-logs/page.tsx)
- 履歴一覧で `managementNo === 'INTERNAL'` のレコードを表示する際、そのまま「INTERNAL」と表示せず、**「自社在庫 (予備)」** と分かりやすく表示し、バッジ等で区別する。

## 検証計画
### 手動検証
1. Kioskモードで「エアコン持ち出し」を選択。
2. 「予備（自社在庫）」ボタンを押下し、管理No入力欄が消えることを確認。
3. 持ち出しを完了させる。
4. 管理画面のエアコン履歴を確認し、「自社在庫 (予備)」として記録されていることを確認する。
