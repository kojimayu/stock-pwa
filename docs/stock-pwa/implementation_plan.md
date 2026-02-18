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

    - `app/(admin)/admin/aircon-inventory/page.tsx` を改修し、業者在庫と合算した総在庫を表示。
    - **Backend (`lib/aircon-actions.ts`)**
        - `getAirconStockWithVendorBreakdown` を修正。
        - 業者在庫の定義を変更: `managementNo` が `null` (または空) の未返却レコードのみを集計対象とする。
    - **Database Schema**:
        - `AirConditionerLog` の `managementNo` を `String?` (Optional) に変更。
        - 既存のデータはそのまま維持（管理番号あり＝案件紐づき＝業者在庫ではない）。
    - **UIデザイン**:
        - テーブルのカラム構成を変更:
            - ベースコード (RAS-AJ22等)
            - 倉庫在庫 (現在の `stock`)
            - 業者在庫 (各業者の持出数合計)
            - 総在庫 (倉庫 + 業者)
            - 詳細 (クリック/ホバーで「A社: 2台, B社: 1台」の内訳を表示)
    - ※ `app/(admin)/admin/aircon-stock/page.tsx` は廃止または統合。

## 検証計画
### 手動検証
1. **担当者記録**: Kioskでログインしてエアコンを持ち出し、管理画面の履歴で担当者名が表示されるか確認。
2. **手動入力**: 「手動入力」ボタンから任意の管理Noで登録し、履歴に反映されるか確認。
3. **区分選択**: 内機のみ持ち出しを選択し、履歴に「INDOOR」として記録されるか確認。在庫ダッシュボードでの表示も確認。
4. **ダッシュボード**: 複数の業者で持ち出しを行い、ダッシュボードで業者ごとに正しく分類されて表示されるか確認。

### 自動テスト
- 今回はUIの変更が主であるため、既存のE2Eテストへの影響はない見込み。新規機能のE2Eテストは別途検討。
