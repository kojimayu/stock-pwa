# お知らせモーダル改善 — 横幅拡大＋音声案内

## 背景
- ログイン後のお知らせモーダルが縦長で読みにくい
- 誰もテキストを読まないため、音声で全文を案内する

## 変更ファイル

### [MODIFY] announcement-modal.tsx
1. **横幅**: `max-w-lg`(512px) → `max-w-2xl`(672px)
2. **音声案内**:
   - モーダル表示 → 自動で全文読み上げ開始
   - **停止ボタンなし** — モーダルを閉じても読み上げは最後まで続行
   - `vendorUser.id` + 日付で localStorage に記録し、**1日1回/担当者** で読み上げ
   - `speechSynthesis` 未対応ブラウザでは読み上げスキップ

### [MODIFY] mode-select/page.tsx
- `AnnouncementModal` に `vendorUserId` prop を渡す（1日1回制御用）

## 検証計画
- ブラウザでKioskログイン後にモーダル確認
