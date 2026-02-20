# Changelog

## [Unreleased]

### Added
- **エアコン発注システム** (2026-02-20): 発注管理画面を全面リニューアル。注文書PDF自動生成（jsPDF）、メール自動送信（Graph API + PDF添付）、納品先拠点管理、発注番号自動採番（AC-2026-001形式）、入荷チェック機能を統合。
- **発注メール設定画面** (2026-02-20): 送信先（To）/CC/差出元を管理画面から変更可能に。納品先拠点CRUDも同画面に統合。
- **DeliveryLocationモデル** (2026-02-20): 納品先拠点のDBモデル追加。AirconOrderに発注番号・拠点・発注者・送信日時フィールド追加。
- **エアコン代理入力機能** (2026-02-20): 管理画面にエアコン持出しの代理入力ページを追加（`/admin/proxy-aircon`）。業者選択 → 引取日指定 → 管理No検索 → 機種選択 → 確定の一連フローを実装。
- **getAirconProducts関数追加** (2026-02-20): `aircon-actions.ts` にエアコン発注管理用のシンプルな商品一覧取得関数を追加。ビルドエラーを解消。
- **エアコン代理入力バッジ** (2026-02-20): `AirConditionerLog` に `isProxyInput` フィールドを追加。エアコン持出し履歴で代理入力を紫バッジ「代」で表示（材料側と同じ仕様に統一）。
- **カテゴリサイドバー閉じるボタン** (2026-02-20): 業者画面のカテゴリサイドバー上部にヘッダー＋✕ボタンを追加。直感的に閉じられるよう改善。

### Changed
- **サイドバー並び順統一** (2026-02-20): 材料管理・エアコン管理の両方で「履歴を先頭、代理入力を末尾」に並び順を統一。

### Fixed
- **バックアップスクリプト修正** (2026-02-19): `backup_db.ps1` が `.env` の `DATABASE_URL` を動的に読み取るよう修正。旧設定 (`prisma/dev.db` ハードコード) が実際の稼働DBと乖離し、2/15-2/18のバックアップが取れていなかった問題を解消。

### Maintenance
- **データ復旧** (2026-02-19): `dev_20260218_135014.db` (2/14時点) + `prisma/test.db` (2/18時点) からデータマージ完了。テストTX#43削除。復旧用一時ファイル39個を削除。

### Added
- **Auto Logout**: Increased idle timeout from 5 minutes to 10 minutes. Added warning message to Kiosk login screen.
- **Session Persistence**: Checkout processes (Material & Aircon) now keep the user on the same screen instead of redirecting to a completion page, allowing for continued operation or history checking.
- **Stock Verification**: Added stock verification dialog to Material Checkout (CartSidebar) to match Aircon workflow.
- **Quantity Warning**: Added warning dialog when selecting odd quantities for paired items (e.g., cosmetic blocks).
- **Vitest単体テスト基盤** (2026-02-19): サーバーアクションの自動テスト27ケースを導入（認証10, 取引8, 在庫9）。テスト専用DB分離で安全に実行可能。
- **機能レジストリ** (2026-02-19): `docs/FEATURE_REGISTRY.md` を作成。全機能（Kiosk 20, Admin 26, API 6, モデル15）を一覧化。

### Fixed
- **Aircon Stock Check**: Fixed critical issue where air conditioners could be checked out even with 0 stock. Added strict server-side stock validation and detailed error messages.
- **Return Validation**: Implemented strict validation for return quantities based on previous return history, preventing excessive returns.
- **UI**: Cleaned up Kiosk headers (removed vendor name) and enhanced visibility of History buttons.
- **Admin UI**: Made admin sidebar menus collapsible for better navigation.

## [2026-02-18]
- Initial changelog creation consistent with recent changes.
