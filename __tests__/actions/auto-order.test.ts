import { describe, it, expect, vi } from 'vitest';

/**
 * 自動発注候補ロジックのユニットテスト
 * 
 * ロジック: `stock + 発注済み数量 < minStock` なら発注候補になる
 * 不足数: `minStock - stock - 発注済み数量`
 */

// generateDraftOrders内部のフィルタロジックを抽出してテスト
interface TestProduct {
    id: number;
    code: string;
    name: string;
    stock: number;
    minStock: number;
    supplier: string;
    cost: number;
}

interface TestOrderItem {
    productId: number;
    quantity: number;
    receivedQuantity: number;
}

function calcPendingByProduct(orderItems: TestOrderItem[]) {
    const map = new Map<number, number>();
    for (const item of orderItems) {
        const pending = item.quantity - item.receivedQuantity;
        if (pending > 0) {
            map.set(item.productId, (map.get(item.productId) || 0) + pending);
        }
    }
    return map;
}

function filterTargetProducts(products: TestProduct[], pendingQtyMap: Map<number, number>) {
    return products.filter(p => {
        const pendingQty = pendingQtyMap.get(p.id) || 0;
        return (p.stock + pendingQty) < p.minStock;
    });
}

function calcDeficit(product: TestProduct, pendingQty: number) {
    return Math.max(1, product.minStock - product.stock - pendingQty);
}

describe('自動発注候補ロジック', () => {
    const product1: TestProduct = { id: 1, code: 'A001', name: '商品A', stock: 20, minStock: 60, supplier: '仕入先A', cost: 100 };
    const product2: TestProduct = { id: 2, code: 'A002', name: '商品B', stock: 50, minStock: 30, supplier: '仕入先A', cost: 200 };
    const product3: TestProduct = { id: 3, code: 'B001', name: '商品C', stock: 5, minStock: 10, supplier: '仕入先B', cost: 300 };

    describe('発注済み数量の集計', () => {
        it('商品ごとに未入荷分を正しく集計する', () => {
            const items: TestOrderItem[] = [
                { productId: 1, quantity: 20, receivedQuantity: 0 },   // 20個未入荷
                { productId: 1, quantity: 10, receivedQuantity: 5 },   // 5個未入荷
                { productId: 3, quantity: 15, receivedQuantity: 15 },  // 全入荷済み → 0
            ];
            const map = calcPendingByProduct(items);
            expect(map.get(1)).toBe(25);  // 20 + 5
            expect(map.get(3)).toBeUndefined(); // 全入荷済みはMapに入らない
        });

        it('発注なしの場合は空マップ', () => {
            const map = calcPendingByProduct([]);
            expect(map.size).toBe(0);
        });
    });

    describe('候補商品のフィルタリング', () => {
        it('在庫 + 発注済み < 最低在庫 → 候補に含まれる', () => {
            // 在庫20 + 発注済み20 = 40 < 最低60 → 候補あり
            const pending = new Map([[1, 20]]);
            const targets = filterTargetProducts([product1], pending);
            expect(targets.length).toBe(1);
        });

        it('在庫 + 発注済み >= 最低在庫 → 候補に含まれない', () => {
            // 在庫20 + 発注済み40 = 60 >= 最低60 → 候補なし
            const pending = new Map([[1, 40]]);
            const targets = filterTargetProducts([product1], pending);
            expect(targets.length).toBe(0);
        });

        it('在庫が既に最低在庫以上 → 候補なし', () => {
            // 在庫50 >= 最低30 → 候補なし
            const pending = new Map<number, number>();
            const targets = filterTargetProducts([product2], pending);
            expect(targets.length).toBe(0);
        });

        it('発注なしで在庫 < 最低在庫 → 候補あり', () => {
            // 在庫20 + 発注0 = 20 < 最低60 → 候補あり
            const pending = new Map<number, number>();
            const targets = filterTargetProducts([product1], pending);
            expect(targets.length).toBe(1);
        });

        it('複数商品の混在テスト', () => {
            // product1: 在庫20 + 発注済み20 = 40 < 最低60 → 候補○
            // product2: 在庫50 + 発注済み0 = 50 >= 最低30 → 候補×
            // product3: 在庫5 + 発注済み0 = 5 < 最低10 → 候補○
            const pending = new Map([[1, 20]]);
            const targets = filterTargetProducts([product1, product2, product3], pending);
            expect(targets.length).toBe(2);
            expect(targets.map(p => p.id)).toEqual([1, 3]);
        });
    });

    describe('不足数の計算', () => {
        it('在庫20, 発注済み20, 最低60 → 不足20', () => {
            expect(calcDeficit(product1, 20)).toBe(20);
        });

        it('在庫5, 発注済み0, 最低10 → 不足5', () => {
            expect(calcDeficit(product3, 0)).toBe(5);
        });

        it('在庫20, 発注済み0, 最低60 → 不足40', () => {
            expect(calcDeficit(product1, 0)).toBe(40);
        });

        it('不足数が0以下になる場合は1を返す', () => {
            // 在庫50 + 発注0, 最低30 → 計算上は-20だが最低1
            expect(calcDeficit(product2, 0)).toBe(1);
        });

        it('在庫20, 発注済み38, 最低60 → 不足2', () => {
            expect(calcDeficit(product1, 38)).toBe(2);
        });
    });
});
