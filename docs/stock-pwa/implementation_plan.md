# エアコン持出し管理機能（シリアルNo対応）実装計画

## 目標
キオスクアプリにおいて、従来の「材料持出し（数量管理）」に加え、「エアコン持出し（管理No/シリアル管理）」を可能にする。
エアコン持出し時は、現場の `Access DB` から物件情報を検索し、正しい型番のエアコンを選択・記録できるようにする。

## ユーザー確認事項
- **Access DBパス**: `C:\AccessData\作業管理・２０１１年７月以降.accdb`
- **同期方式**: `node-adodb` を使用した直接接続

## 提案する変更

### フローの変更（UI）
現在の「ログイン -> 即お買い物」のフローを変更し、ログイン後に「作業モード選択」を挟みます。
1. **ログイン画面** (`/`): 業者選択 -> PIN入力（既存のまま）
2. **モード選択画面** (`/mode-select`): [新規]
    - 「材料持出し」 -> 従来の商品選択画面 (`/shop`) へ移動
    - 「エアコン持出し」 -> 新しいエアコン管理画面 (`/aircon`) へ移動

### データベース設計 (Prisma)
#### [MODIFY] [schema.prisma](file:///f:/Antigravity/stock-pwa/prisma/schema.prisma)
- エアコン持出し履歴用のモデル `AirConditionerLog` を追加
```prisma
model AirConditionerLog {
  id           Int      @id @default(autoincrement())
  managementNo String   // 管理No (6桁)
  customerName String?  // Access: 顧客名
  contractor   String?  // Access: 元請/下請
  modelNumber  String   // 品番 (MSZ-...)
  vendorId     Int      // 持出した業者ID
  vendor       Vendor   @relation(fields: [vendorId], references: [id])
  createdAt    DateTime @default(now())
}
```
※Accessのマスターデータを全件コピーするのではなく、検索時に都度Accessへ問い合わせ、結果（履歴）のみをPrismaに保存する方針とします（リアルタイム性重視）。

### バックエンド / Access連携
#### [NEW] [app/api/access/route.ts](file:///f:/Antigravity/stock-pwa/app/api/access/route.ts)
- `node-adodb` を使用してAccess DBへ接続
- クエリパラメータ `managementNo` を受け取り、該当する工事情報をJSONで返すAPIを作成

### フロントエンド実装
#### [MODIFY] [app/(kiosk)/page.tsx](file:///f:/Antigravity/stock-pwa/app/(kiosk)/page.tsx)
- ログイン成功後の遷移先を `/mode-select` に変更

#### [NEW] [app/(kiosk)/mode-select/page.tsx](file:///f:/Antigravity/stock-pwa/app/(kiosk)/mode-select/page.tsx)
- 「材料（消耗品）」と「エアコン（機器）」の大きなボタンを配置

#### [NEW] [app/(kiosk)/aircon/page.tsx](file:///f:/Antigravity/stock-pwa/app/(kiosk)/aircon/page.tsx)
- 管理No入力フォーム（テンキー/バーコード）
- 検索結果表示（物件名・必要能力）
- 品番入力/選択フォーム
- 確定ボタン

### 補足：型番・色展開のルール
型番の末尾により、以下の通り色を識別・展開します。
- `アイボリー`: Suffix `-I`
- `ブラウン`: Suffix `-BR`
- `ブラック`: Suffix `-BK`
- `ホワイト`: Suffix `-W`
- `グレー`: Suffix `-G`

## 検証計画
### 手動検証
1. **Access連携**: ダミーの `.accdb` ファイル（または本番ファイルのコピー）を使用し、指定した管理Noで正しいデータが返ってくるかAPIテストを行う。
2. **UIフロー**:
    - ログイン -> モード選択 -> エアコン画面への遷移を確認。
    - 管理No入力 -> 情報表示 -> 品番入力 -> 保存 の一連の流れがエラーなく行えるか確認。
    - 保存後、Admin管理画面等でデータが確認できるか（必要であればAdmin画面も追加）。
