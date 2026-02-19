# Changelog

## [Unreleased]

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
