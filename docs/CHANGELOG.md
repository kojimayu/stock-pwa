# Changelog

## [Unreleased]

### Improved
- **ダッシュボード在庫中心レイアウト** (2026-02-26): 統計カード4枚を廃止。アラートをコンパクトなバナー形式に変更（在庫切れ/在庫注意/正常の3種）。エアコン在庫を容量別テーブルで表示（`AirconProduct`から直接取得、材料側との数量不整合を解消）。発注状況を材料・エアコン分離表示に。持出し履歴を5件→3件のリスト形式に縮小。
- **エアコン在庫アラート** (2026-02-26): ダッシュボードのアラートバナーにエアコン在庫切れ/在庫注意を追加。材料と同様にminStockを下回った場合に発注を促す。
- **エアコン最低在庫数設定** (2026-02-26): エアコン発注設定ページに最低在庫数の編集セクションを追加。品番ごとにminStockを設定可能に。`updateAirconMinStock`サーバーアクション追加。
- **持出し表示改善** (2026-02-26): ダッシュボードの「最近のエアコン持出し」を履歴ページと同じグループ化テーブル形式（日時/業者名/管理No/顧客名/機種・台数/状態）に変更。担当者名も表示。
- **エアコン発注の納期管理** (2026-02-26): AirconOrderに`expectedDeliveryDate`フィールド追加。発注済み注文に「納期回答」ボタンで納期入力可能に。納期超過は赤色アラート、納期未回答は黄色アラートとしてダッシュボード・発注ページに表示。
- **金額カンマ表示** (2026-02-26): 発注単価管理のロック時表示を`¥XX,XXX`のカンマ付き形式に変更。システム全体の金額表示は`formatCurrency`/`toLocaleString`で既にカンマ対応済みであることを確認。
- **DB安全対策ドキュメント** (2026-02-26): `docs/DATABASE_SAFETY.md`と`.agent/workflows/db-safety.md`を新規作成。`prisma db push --accept-data-loss`禁止、バックアップ必須化等の安全ルールを整備。

### Fixed
- **DB復元** (2026-02-26): `prisma db push --accept-data-loss`によるデータ消失を23時定期バックアップから復元。

### Removed
- **エアコン発注設定の売価A/B** (2026-02-26): 発注設定画面から「売価A（通常）」「売価B（特別）」のカラムを削除。発注に無関係で紛らわしいため。発注単価のみ残す。

### Added
- **材料⇔エアコン在庫連携** (2026-02-24): 材料マスタのエアコン商品（RSAJ22等）をエアコンマスタ（RAS-AJ22等）と紐づけ。材料チェックアウト時にエアコン在庫を自動減算し、PURCHASEログ（買取記録）を作成。エアコン在庫変動時は材料在庫も自動同期。ProductモデルにairconProductIdフィールド追加。
- **エアコン一時貸出フラグ** (2026-02-24): AirConditionerLogにisTemporaryLoanフィールド追加。管理No付き持出しでも「一時貸出」をマークすると業者持出しにカウントされる。引当変更ダイアログから切替可能。
- **一時貸出テスト** (2026-02-24): 一時貸出フラグ・タイプ別集計・引当変更・戻し処理・業者別集計の包括的テスト（13テストケース）を追加。
- **メール安全ガードテスト** (2026-02-25): `lib/email-safety.ts`にcheckEmailSafety関数を抽出。開発環境で本番宛先にメールが飛ばないことを9テストで保証。
- **発注連番フォーマット変更** (2026-02-25): 発注番号を`AC-2026-001`→`20260225-001`（日付+連番）に変更。
- **発注確定時のメール送信選択** (2026-02-25): 発注確定ダイアログで「メール送信して確定」「登録のみ（メールなし）」を選択可能に。メールを別途送った場合の発注登録に対応。
- **エアコン業者別販売価格** (2026-02-25): AirconProductにpriceA/B/C（販売単価）、VendorにpriceTier（価格ランク）を追加。業者ごとにA（通常）/B（特別）の販売価格を適用可能に。発注設定画面で販売単価A/Bを管理、業者編集でAC価格ランクを設定。
- **タブレット自動回復** (2026-02-25): サーバー再起動やビルド変更時にタブレット（Kiosk）が自動回復する3層メカニズムを実装。①error.tsx（10秒自動リトライ）②ネットワーク復帰検知 ③サーバーダウン検知＋復帰時自動リロード。チェック間隔を5分→1分に短縮。
- **材料戻し操作ログ記録** (2026-02-25): 材料の「戻す」操作時に、元の明細（業者名・担当者・商品リスト・金額）をOperationLogに記録。全量戻し・部分戻しの両方に対応。戻した後でも「何を持ち出していたか」が追跡可能に。テスト5件追加。

### Fixed
- **エアコンデータ表示エラー修正** (2026-02-21): AirConditionerLog.noteカラムがDBに未反映だった問題を修正。DATABASE_URLの参照先DB（ルートdev.db）にALTER TABLEで追加。
- **商品選択画面のログアウト記録漏れ** (2026-02-22): shop-interface.tsxのログアウトボタンでlogLogout()が未呼出しだったバグを修正。
- **開発環境リロードループ** (2026-02-22): next.config.tsで開発時のbuildDateを固定値にし、VersionCheckerによるリロードループを防止。
- **買取(PURCHASE)ログが「外機」と表示される問題** (2026-02-25): ログ画面のternaryでPURCHASEがelseに落ちて「外機」表示になっていた問題を修正。「買取」赤バッジで表示。業者持出し(vendorStock)からも除外。
- **エアコン代理入力の日時がcreatedAtになる問題** (2026-02-25): 代理入力時に指定した引取日がエアコンログに反映されず入力日時になっていた。APIルートでtransactionDateをcreatedAtに設定。
- **材料買取エアコンログの日時不一致** (2026-02-25): 材料買取時のエアコンログ日時がトランザクション日時と異なっていた。createdAtにtransaction.dateを設定。

### Improved
- **エアコン在庫 持出し内訳表示** (2026-02-22): エアコン在庫管理ページにSET/内機/外機別の持出し内訳カラムを追加。管理番号なし（物件未紐づけ）の借入在庫のみ表示。内機/外機バラ持出し時に「倉庫余り」を表示。業者別ポップオーバーにもtype別内訳を表示。
- **エアコン在庫 セット数表示** (2026-02-24): 総在庫表示を「Xセット + 外機のみY台」形式に変更。セットが揃わないと取付不可なため実質的なセット数を明示。

### Added
- **管理番号の重複チェック** (2026-02-21): エアコン持出し時に同一管理Noの既存ログを検索し、重複がある場合は業者名・台数を警告トーストで注意喚起（ブロックはしない）。Kiosk・代理入力の両方に対応。

### Fixed
- **adjustStock OUT加算バグ修正** (2026-02-21): type='OUT'時に在庫が加算されるバグを修正。OUT時は減算に変更＋在庫不足チェックを追加。
- **部材棚卸し重複開始ガード追加** (2026-02-21): IN_PROGRESSの棚卸しがある場合は新規開始をブロック。

### Improved
- **カート内カテゴリ表示** (2026-02-21): カートリストで商品名の下にカテゴリ/サブカテゴリを表示して商品間違いを防止。
- **エアコン持出しメモ欄** (2026-02-21): エアコン持出し時にメモ（新築物件名等）を入力可能に。Kiosk・代理入力の両方に対応。スキーマにnoteフィールド追加。
- **バックアップ整合性テスト** (2026-02-21): テスト実行時に自動バックアップの復元可能性を検証（SQLiteヘッダー・Prismaクエリ・主要テーブルデータ確認）。
- **音声入力ボタン制御** (2026-02-21): http://接続時はマイクボタンを非表示に。HTTPS/localhost環境でのみ表示。
- **エアコン棚卸機能** (2026-02-20): 倉庫調整(+/-)ボタンを廃止し、棚卸セッション方式を導入。開始→実数入力→差異確認→確認者入力→確定のフロー。確定時に在庫を一括更新。中止機能、棚卸履歴表示も対応。Prismaスキーマ（AirconInventoryCount/AirconInventoryCountItem）、Server Actions 6関数、テスト14ケースを追加。
- **注文書PDF日本語化** (2026-02-20): 注文書PDFをExcel雛形準拠の日本語形式に刷新。pdfkit + Noto Sans JPによるサーバーサイド生成に切替。宛先（日立GLS）・差出元（プラスカンパニー）・テーブル（名称/数量/単位/単価/金額）・小計/消費税/合計の完全対応。
- **発注単価管理** (2026-02-20): AirconProductに発注単価（orderPrice）フィールドを追加。注文書PDFに自動反映。
- **「その他」納品先対応** (2026-02-20): 発注作成時に「その他（自由入力）」で任意の納品先名を指定可能に。ジンコーポレーション等の非常設拠点に対応。
- **テストモード設定API** (2026-02-20): `/api/config`エンドポイント追加。テストモード判定をクライアントから参照可能に。
- **エアコン発注システム** (2026-02-20): 発注管理画面を全面リニューアル。注文書PDF自動生成（jsPDF）、メール自動送信（Graph API + PDF添付）、納品先拠点管理、発注番号自動採番（AC-2026-001形式）、入荷チェック機能を統合。
- **発注メール設定画面** (2026-02-20): 送信先（To）/CC/差出元を管理画面から変更可能に。納品先拠点CRUDも同画面に統合。
- **DeliveryLocationモデル** (2026-02-20): 納品先拠点のDBモデル追加。AirconOrderに発注番号・拠点・発注者・送信日時フィールド追加。
- **マニュアルページ** (2026-02-20): 管理画面内にマニュアル表示ページを追加（`/admin/manual`）。`docs/MANUAL_ADMIN.md` を読み込んでHTMLに変換して表示。
- **更新履歴ページ** (2026-02-20): 管理画面内に更新履歴ページを追加（`/admin/updates`）。`docs/CHANGELOG.md` を読み込んで表示。
- **エアコン発注テスト** (2026-02-20): 発注CRUD、自動採番、拠点管理、入荷処理（在庫反映・ステータス自動遷移）、メール送信記録、メール設定の19テスト追加。
- **エアコン代理入力機能** (2026-02-20): 管理画面にエアコン持出しの代理入力ページを追加（`/admin/proxy-aircon`）。業者選択 → 引取日指定 → 管理No検索 → 機種選択 → 確定の一連フローを実装。
- **getAirconProducts関数追加** (2026-02-20): `aircon-actions.ts` にエアコン発注管理用のシンプルな商品一覧取得関数を追加。ビルドエラーを解消。
- **エアコン代理入力バッジ** (2026-02-20): `AirConditionerLog` に `isProxyInput` フィールドを追加。エアコン持出し履歴で代理入力を紫バッジ「代」で表示（材料側と同じ仕様に統一）。
- **カテゴリサイドバー閉じるボタン** (2026-02-20): 業者画面のカテゴリサイドバー上部にヘッダー＋✕ボタンを追加。直感的に閉じられるよう改善。
- **サイドバー折りたたみヒント** (2026-02-20): 初回表示時にサイドバーが一瞬閉じて戻るアニメーション＋パルスエフェクトで折りたたみ可能を伝達。localStorageで初回のみ表示。
- **発注済みキャンセル機能** (2026-02-20): 発注済み(ORDERED)ステータスの発注をキャンセル可能に。確認ダイアログ付きで履歴保持。
- **入荷チェック改善** (2026-02-20): 一部入荷に対応（数量入力欄追加）。入荷後にモーダル自動更新、全完了時は自動クローズ。現在在庫数を青色で表示。
- **PDF備考欄修正** (2026-02-20): 備考内容をテーブル内行からテーブル下の備考欄に移動。

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
