# 誤入力修正機能（取引編集）のロジック検討

## 概要
管理者が完了済みの取引（Transaction）の内容を後から修正できる機能を実装する。
主な用途は、業者が数量を間違えて入力したり、違う商品を選択してしまった場合の訂正。

## 3. 再発防止策（Unit Mismatch Prevention）
業者が「IV線 1巻」を「1m」や、「テープ 1箱」を「1個」と勘違いして入力するのを防ぐ。

### 現状の課題
- IV線: 在庫管理は「メートル(m)」だが、現場は「巻(300m)」で持ち出す。
- テープ: 在庫管理は「個」だが、現場は「箱(10個入)」で持ち出す。

### 対策: 「箱・巻」ボタンの強化
### 対策: 「箱・巻」ボタンの強化
1.  **マスタデータの確認・整備 (完了)**:
    - **IV1.6ｍｍ (ID: 65)**: `QtyPerBox: 300` に設定済み。単位を `m` に変更。
    - **ビニールテープ (ID: 66)**: `QtyPerBox: 10` に設定。単位を **`巻`** に変更する（ユーザー要望: 1箱=10巻）。
    - ※Kioskでの金額表示は廃止したため、`pricePerBox`の設定は必須ではない（在庫計算のための`quantityPerBox`が重要）。
2.  **UI改善 (Kiosk)**:
    - `QuantitySelectorDialog` で、「箱（巻）」ボタンに **具体的な入数を表示** する。
        - 表示例: **「箱 (10巻入)」**、**「巻 (300m)」**
    - 「箱」を選択した際、「在庫から **10個** 減ります」といった注釈を表示して、認識を合わせる。
2.  **UI改善 (Kiosk)**:
    - 数量選択画面（`QuantitySelectorDialog`）で、該当商品の場合に「バラ」ではなく**「箱（巻）」をデフォルト**にする、または**「箱（巻）」ボタンを強調**する。
    - 「1巻 (300m)」のように、換算数量を大きく表示して誤認を防ぐ。

---

## 誤入力修正ロジックの設計（Correction Logic）

### 1. データ構造の課題と対応
現在の `Transaction` テーブルは、購入品目を `items` カラムにJSON文字列として保存している。
正規化されたリレーショナルデータ（TransactionItemテーブルなど）ではないため、修正時はJSONをパースして書き換える必要がある。

### 2. 処理フロー
1.  **取引データの取得**
    - 対象のTransactionIDを指定して、現在の `items` (JSON) を取得。
2.  **編集画面（UI）**
    - 管理画面で、JSONを展開して品目リストを表示。
    - 数量の変更、品目の削除、追加（難易度高のため今回は数量変更・削除を優先）を可能にする。
3.  **保存時の処理（Server Action）**
    - **差分計算 (Diff Calculation)**:
        - `変更前の数量` と `変更後の数量` を比較。
        - 差分 = `変更前` - `変更後の数量`
            - 差分がプラス（例: 5個→3個へ訂正）： **在庫を戻す（Increment）**
            - 差分がマイナス（例: 3個→5個へ訂正）： **在庫を減らす（Decrement）**
    - **在庫更新 (Product Update)**:
        - 各商品について、計算した差分で在庫を更新する。
    - **取引データ更新 (Transaction Update)**:
        - 新しい `items` JSONを生成。
        - 合計金額 (`totalAmount`) を再計算して更新。
    - **ログ記録 (Logging)**:
        - `OperationLog` に「取引修正: ID xxx」として記録。
        - `InventoryLog` に「調整: 取引訂正」として在庫変動を記録。

### 3. 具体的なコードイメージ (Server Action)

```typescript
// 擬似コード
async function updateTransaction(transactionId: number, newItems: CartItem[]) {
  // トランザクション開始
  await prisma.$transaction(async (tx) => {
    // 1. 現在のデータを取得
    const currentTx = await tx.transaction.findUnique({ where: { id: transactionId } });
    const oldItems = JSON.parse(currentTx.items);
    
    // 2. 各商品の差分を処理
    for (const newItem of newItems) {
        const oldItem = oldItems.find(i => i.productId === newItem.productId);
        const oldQty = oldItem ? oldItem.quantity : 0;
        const newQty = newItem.quantity;
        
        const diff = oldQty - newQty; // 戻すべき在庫数
        
        if (diff !== 0) {
            // 在庫更新
            await tx.product.update({
                where: { id: newItem.productId },
                data: { stock: { increment: diff } } // diffが正なら在庫増、負なら在庫減
            });
            
            // 在庫ログ
            await tx.inventoryLog.create({
                data: {
                    productId: newItem.productId,
                    type: diff > 0 ? '入庫' : '出庫',
                    quantity: Math.abs(diff),
                    reason: `取引修正 #${transactionId}`
                }
            });
        }
    }
    
    // 3. 削除された商品の処理（oldItemsにあってnewItemsにないもの）
    // ... (同様に在庫を全数戻す)
    
    // 4. Transactionテーブル更新
    await tx.transaction.update({
        where: { id: transactionId },
        data: {
            items: JSON.stringify(newItems),
            totalAmount: calculateTotal(newItems)
        }
    });
  });
}
```

## UI/UX案
- **管理者ダッシュボード > 取引履歴**
- 詳細画面に「編集」ボタンを設置。
- 編集モーダルで数量を変更して「保存」するシンプルなフロー。

## 検討事項
- **価格変動**: 取引当時の価格を維持するか、現在のマスタ価格を適用するか？ -> **当時の価格（JSON内の価格）を維持**すべき。
- **在庫不足**: 修正によって「在庫をさらに減らす」場合、現在の在庫が足りるかチェックが必要。
