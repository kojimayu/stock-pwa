---
description: DBの在庫・取引データを直接調査するワークフロー
---
// turbo-all

# DB調査ワークフロー

在庫の不整合や取引の詳細を調べる際に使用する。

## 前提

- stock-pwa は SQLite (dev.db) を使用
- Prisma Client でクエリ実行
- スクリプトは `scripts/` に一時配置、完了後に削除

## 手順

### 1. 調査スクリプトの基本テンプレート

`scripts/db_query.js` として以下を作成:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    const lines = [];
    // === ここにクエリを記述 ===
    
    fs.writeFileSync('scripts/query_result.txt', lines.join('\n'), 'utf8');
    console.log('Done: scripts/query_result.txt');
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
```

**重要: 結果は必ずファイルに書き出す。** `console.log` だとPowerShellの出力バッファで切れるため。

### 2. よく使うクエリパターン

#### 商品の在庫確認
```javascript
const product = await prisma.product.findFirst({ where: { name: { contains: 'パテ' } } });
lines.push(`ID:${product.id} Code:${product.code} Stock:${product.stock}`);
```

#### 特定商品の取引履歴（Transaction.items は JSON文字列）
```javascript
const txns = await prisma.transaction.findMany({
    where: { items: { contains: '商品名' } },
    include: { vendor: true, vendorUser: true },
    orderBy: { createdAt: 'desc' },
    take: 20
});
for (const t of txns) {
    const items = JSON.parse(t.items);
    const target = items.find(i => i.name === '商品名');
    const d = t.createdAt.toLocaleString('ja-JP', {timeZone:'Asia/Tokyo'});
    lines.push(`Tx#${t.id} | ${d} | ${t.vendor?.name} ${t.vendorUser?.name||''} | qty:${target?.quantity}`);
}
```

#### 特定商品のInventoryLog（在庫変動の全履歴）
```javascript
const logs = await prisma.inventoryLog.findMany({
    where: { productId: 63 }, // idを指定
    orderBy: { createdAt: 'asc' }
});
let running = 0;
for (const l of logs) {
    running += l.quantity;
    const d = l.createdAt.toLocaleString('ja-JP', {timeZone:'Asia/Tokyo'});
    lines.push(`${d} | ${l.type} | qty:${l.quantity} | running:${running} | ${l.reason}`);
}
```

#### 孤児InventoryLog（削除済み取引のログ）検出
```javascript
const txLogs = await prisma.inventoryLog.findMany({
    where: { reason: { startsWith: 'Transaction #' } },
    include: { product: { select: { name: true, code: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
});
for (const l of txLogs) {
    const match = l.reason.match(/#(\d+)/);
    if (match) {
        const tx = await prisma.transaction.findUnique({ where: { id: parseInt(match[1]) } });
        if (!tx) {
            lines.push(`ORPHAN logId:${l.id} | ${l.product.name} | qty:${l.quantity} | ${l.reason}`);
        }
    }
}
```

#### 取引の詳細（IDで直接）
```javascript
const t = await prisma.transaction.findUnique({
    where: { id: 148 },
    include: { vendor: true, vendorUser: true }
});
if (!t) { lines.push('Tx#148: 存在しない（削除済み）'); }
else {
    const items = JSON.parse(t.items);
    lines.push(`Tx#${t.id} | ${t.vendor?.name} | items: ${items.map(i => `${i.name}x${i.quantity}`).join(', ')}`);
}
```

### 3. 実行

```powershell
node scripts/db_query.js 2>&1
```

結果を確認:
```powershell
cat scripts/query_result.txt
```
→ ファイル読み取りは `view_file` ツールで行う。

### 4. クリーンアップ

調査完了後は一時ファイルを削除:
```powershell
Remove-Item scripts/db_query.js, scripts/query_result.txt -Force -ErrorAction SilentlyContinue
```

### 5. 在庫整合性チェック（InventoryLog vs DB在庫）

3/29の棚卸し時に一括補正予定。以下のスクリプトで現状確認可能。

#### 全商品の乖離チェック
```javascript
const products = await prisma.product.findMany({ select: { id: true, name: true, stock: true, code: true, unit: true } });
let mismatchCount = 0;
for (const prod of products) {
    const logs = await prisma.inventoryLog.findMany({ where: { productId: prod.id } });
    const logSum = logs.reduce((s, l) => s + l.quantity, 0);
    if (logSum !== prod.stock) {
        mismatchCount++;
        const diff = prod.stock - logSum;
        lines.push(`⚠ #${prod.id} ${prod.code} ${prod.name}: DB=${prod.stock} Log=${logSum} diff=${diff > 0 ? '+' : ''}${diff}`);
    }
}
lines.push(`不一致: ${mismatchCount}件 / ${products.length}件`);
```

#### 特定商品のInventoryLog全件 + running total
```javascript
const productId = 62; // 調べたい商品ID
const prod = await prisma.product.findUnique({ where: { id: productId } });
const logs = await prisma.inventoryLog.findMany({ where: { productId }, orderBy: { createdAt: 'asc' } });
let running = 0;
lines.push(`${prod.code} ${prod.name} | DB在庫: ${prod.stock}`);
for (const l of logs) {
    running += l.quantity;
    const ts = l.createdAt.toISOString().slice(5, 16).replace('T', ' ');
    lines.push(`id=${l.id} | ${l.quantity > 0 ? '+' : ''}${l.quantity} | sum=${running} | ${(l.reason || l.type).slice(0, 50)} | ${ts}`);
}
lines.push(`InventoryLog合計: ${running} | DB: ${prod.stock} | diff: ${prod.stock - running}`);
```

#### 一括補正（DB在庫を正として、InventoryLogに調整ログ追加）
```javascript
// ⚠ 棚卸し確認後のみ実行すること
for (const prod of products) {
    const logs = await prisma.inventoryLog.findMany({ where: { productId: prod.id } });
    const logSum = logs.reduce((s, l) => s + l.quantity, 0);
    if (logSum !== prod.stock) {
        const diff = prod.stock - logSum;
        await prisma.inventoryLog.create({
            data: {
                productId: prod.id,
                type: '在庫調整',
                quantity: diff,
                reason: `棚卸し補正 (DB=${prod.stock}, Log=${logSum}, diff=${diff > 0 ? '+' : ''}${diff})`
            }
        });
        lines.push(`✅ #${prod.id} ${prod.name}: 補正 ${diff > 0 ? '+' : ''}${diff}`);
    }
}
```

## 注意事項

- **Product.stock と InventoryLog は独立管理**。棚卸完了時に `stock = actualStock` で直接上書きされるため、InventoryLogの累計とProduct.stockは一致しないことがある。
- **Transaction.items は JSON文字列**。リレーションテーブルではない。`JSON.parse()` が必要。
- **商品コードに全角文字あり**（例: `APｰ200ｰI`）。`contains` で部分一致検索するか、`name` で検索する方が確実。
- **日時は UTC で保存**。表示時に `toLocaleString('ja-JP', {timeZone:'Asia/Tokyo'})` で JST 変換。
