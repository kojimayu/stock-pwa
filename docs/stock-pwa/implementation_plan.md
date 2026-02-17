# エアコン管理機能・UX改善 実装計画

## 概要
エアコン管理機能において、現場からのフィードバックに基づき以下の4点を改善する。
1. **担当者記録**: 誰が持ち出したかを明確にする。
2. **手動入力モード**: 業者在庫や新築先行案件など、管理Noが未発行のケースに対応する。
3. **内機・外機区分の対応**: セットだけでなく、バラでの持ち出し・返却に対応する。
4. **業者別予備在庫ダッシュボード**: 業者の手元にある在庫状況を可視化する。

## 前提条件
- `AirConditionerLog` テーブルには既に `vendorUserId` と `type` カラムが存在するため、スキーマ変更（マイグレーション）は不要。

## 実装詳細

### 1. 担当者名の記録
- **Backend (`lib/actions.ts`)**
    - `createAirConditionerLog` 関数を修正し、オプショナルな引数 `vendorUserId: number` を受け取る。
    - DB保存時に `vendorUserId` を記録する。
- **Frontend (Kiosk)**
    - `app/(kiosk)/aircon/page.tsx`: 現在の `vendorUser` (Zustand store) を取得し、Server Action呼び出し時にIDを渡す。
- **Frontend (Admin)**
    - `app/(admin)/admin/aircon-logs/page.tsx`: 履歴リストのクエリで `vendorUser` をincludeし、テーブルに「担当者」列を追加して表示する。

### 2. 手動入力モード（業者在庫・新築先行）
- **UI (`components/kiosk/checkout-type-select.tsx`)**
    - 「業者在庫・手動入力」ボタンを追加。
- **UI (新規コンポーネント: `components/kiosk/manual-entry-dialog.tsx`)**
    - 管理No（任意入力）と顧客名（任意入力）を入力するダイアログ。
    - 入力後、機種選択フローへ進む。
    - `lib/store.ts` または URLパラメータで入力値を保持し、最終的な登録時に使用する。

### 3. 内機・外機区分の対応
- **UI (`app/(kiosk)/aircon/page.tsx` または `components/kiosk/aircon-model-select.tsx`)**
    - 機種選択時、または確認画面で「セット / 内機のみ / 外機のみ」を選択できるUI (RadioGroup/ToggleGroup) を追加。
    - デフォルトは「セット」。
- **Backend (`lib/actions.ts`)**
    - `createAirConditionerLog` 関数に `type: string` 引数を追加（'SET', 'INDOOR', 'OUTDOOR'）。

### 4. 業者別予備在庫ダッシュボード
- **Backend (`lib/actions.ts`)**
    - `getVendorAirconStock()` 関数を作成。
    - `AirConditionerLog` から `isReturned: false` のレコードを全取得し、`vendorId` ごとに集計・グループ化して返す。
- **Frontend (Admin)**
    - `app/(admin)/admin/aircon-stock/page.tsx` を新規作成。
    - 業者ごとにアコーディオンまたはカード形式で、現在持ち出し中のエアコン一覧（管理No、機種データ、区分、日付）を表示。
    - 「自社在庫 (INTERNAL)」や「手動入力」分もここで確認できるようにする。

## 検証計画
### 手動検証
1. **担当者記録**: Kioskでログインしてエアコンを持ち出し、管理画面の履歴で担当者名が表示されるか確認。
2. **手動入力**: 「手動入力」ボタンから任意の管理Noで登録し、履歴に反映されるか確認。
3. **区分選択**: 内機のみ持ち出しを選択し、履歴に「INDOOR」として記録されるか確認。在庫ダッシュボードでの表示も確認。
4. **ダッシュボード**: 複数の業者で持ち出しを行い、ダッシュボードで業者ごとに正しく分類されて表示されるか確認。

### 自動テスト
- 今回はUIの変更が主であるため、既存のE2Eテストへの影響はない見込み。新規機能のE2Eテストは別途検討。
