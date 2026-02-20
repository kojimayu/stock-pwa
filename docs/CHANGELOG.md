# Changelog

## [Unreleased]

### Added
- **エアコン代理入力機能** (2026-02-20): 管理画面にエアコン持出しの代理入力ページを追加（`/admin/proxy-aircon`）。業者選択 → 引取日指定 → 管理No検索 → 機種選択 → 確定の一連フローを実装。
- **getAirconProducts関数追加** (2026-02-20): `aircon-actions.ts` にエアコン発注管理用のシンプルな商品一覧取得関数を追加。ビルドエラーを解消。

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
