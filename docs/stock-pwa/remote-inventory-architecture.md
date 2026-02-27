# 遠隔拠点エアコン在庫管理 — 設計まとめ

> 2026-02-27 の議論をまとめたもの。着手はまだしない。

---

## 1. 概要

各業者拠点（10拠点未満）のエアコン在庫をstock-pwaで管理し、物件への引当・持出し・完了までを一元管理する。

## 2. 確定した方針

| 項目 | 決定 |
|------|------|
| 対象 | **エアコンのみ**（材料は対象外） |
| 拠点数 | 10未満（業者管理の拠点に登録済み） |
| 物件マスタ | **進捗管理システム（`F:\progress_system`）の`Construction`テーブルを活用**（重複テーブル作らない） |
| データ連携 | **クラウド1本**。Access→進捗管理→stock-pwa。ローカルAccess直叩きは廃止方向 |
| 受注金額 | 取り込み不要 |
| 在庫管理方式 | `stock`（実在庫）+ `reserved`（引当数）の2値。`available = stock - reserved` で計算 |
| 開発順序 | ローカルで開発→完成後クラウドにデプロイ |

## 3. システム構成

```
Access DB（ローカル）
    ↓ sync_access_db.py（差分同期）
進捗管理システム（Azure/Flask）
    ↑ update_access_db.py（書き戻し）
    ↓ API（物件検索）
stock-pwa（Azure/Next.js）
    └─ 在庫管理・持出し・引当
```

**既存のstock-pwa `/api/access`（PowerShellでAccess直叩き）は将来的に進捗管理API呼び出しに差し替え。**

## 4. AccessのQ_WebSyncへの追加が必要な列

現在の`Q_WebSync`に含まれていないが必要なデータ：
- **材工チェック** — 自社在庫を使うかどうかの判別
- **22kw, 25kw, 28kw, 36kw, 40kw** — 容量別エアコン台数（Accessの`プラスカンパニー工事管理テーブル`にはある）

## 5. stock-pwaに追加するテーブル

### `LocationAirconStock`（拠点別エアコン在庫）
```
productId  → AirconProduct
locationId → DeliveryLocation
stock      : 実在庫数
reserved   : 引当済み数
```

### `AirconAllocation`（エアコン引当記録）
```
managementNo  : 管理番号（進捗管理のConstruction.id）
propertyName  : 物件名（スナップショット）
locationId    → どの拠点から
productId     → AirconProduct（容量別）
quantity      : 台数
status        : ALLOCATED → CHECKED_OUT → COMPLETED / RETURNED / CANCELLED
completedAt   : 完了日
```

## 6. 持出しフロー（14パターン）

📄 詳細: [allocation-flow-patterns.md](file:///f:/Antigravity/stock-pwa/docs/stock-pwa/allocation-flow-patterns.md)

**正常系:**
- 引当→持出し→完了（ボタン: 🔵→🟠→🟢）
- 工事のみ（材工なし）→ ボタン非表示

**要警告:**
- 持出しなしで完了 → ⚠️
- 持出し後キャンセル → 戻し必須
- 容量不一致 → ⚠️
- 材工チェック取消 → 同期時検知
- 異なる拠点からの持出し → ⚠️
- 長期持出し中 → ダッシュボードアラート

**分岐:**
- 一部完了+一部持帰り → 台別処理

## 7. 実装Phase

| Phase | 内容 | 主な作業 |
|-------|------|---------|
| 1 | データ基盤 | テーブル追加、マイグレーション |
| 2 | 管理画面 | 拠点在庫一覧、入庫、移動、Excelインポート |
| 3 | 物件連携+引当 | 進捗管理API追加、管理No検索、引当処理 |
| 4 | 業者向けUI | 遠隔Kiosk、持出し・戻し操作 |
| 5 | デプロイ+バックアップ | Azure、ローカルバックアップ、オフライン対策 |

## 8. 次回やること

- [ ] 上記設計のレビュー・修正を経て着手タイミングを決定
- [ ] `Q_WebSync` に材工・容量列を追加する作業（Access側）
- [ ] 進捗管理システムの `Construction` モデルに材工・容量列を追加
- [ ] Phase 1（テーブル追加）から着手

## 9. 今日のダッシュボード改修（完了済み）

- ✅ エアコン発注の表示に**納品先**と**納品予定日**を追加（納期未定は黄色表示）
- ✅ 材料発注の表示に**主な品目名**を追加
- ✅ ビルド成功確認済み
