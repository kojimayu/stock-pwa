/**
 * 互換品管理のテスト
 * 
 * DB依存なし: ロジックを抽出してテスト
 */
import { describe, it, expect } from 'vitest';

interface TestProduct {
    id: number;
    code: string;
    name: string;
    stock: number;
    minStock: number;
    cost: number;
    supplier: string | null;
    compatibleGroupId: string | null;
}

// 互換品グループ化ロジック
function groupCompatibleProducts(products: TestProduct[]) {
    const groups = new Map<string, TestProduct[]>();
    for (const p of products) {
        if (p.compatibleGroupId) {
            const group = groups.get(p.compatibleGroupId) || [];
            group.push(p);
            groups.set(p.compatibleGroupId, group);
        }
    }
    return groups;
}

// 互換品取得ロジック
function getCompatibles(product: TestProduct, products: TestProduct[]) {
    if (!product.compatibleGroupId) return [];
    return products.filter(
        p => p.compatibleGroupId === product.compatibleGroupId && p.id !== product.id
    );
}

// 自動発注候補フィルタ（互換品の在庫は合算しない）
function filterOrderCandidates(products: TestProduct[], pendingQtyMap: Map<number, number>) {
    return products.filter(p => {
        const pendingQty = pendingQtyMap.get(p.id) || 0;
        return (p.stock + pendingQty) < p.minStock;
    });
}

describe('互換品管理', () => {
    const ks70b: TestProduct = {
        id: 1, code: 'KS70B', name: 'KS70B', stock: 20, minStock: 60,
        cost: 95, supplier: '関東機材', compatibleGroupId: 'KS70系',
    };
    const ld70: TestProduct = {
        id: 2, code: 'LD70', name: 'LD70', stock: 5, minStock: 60,
        cost: 110, supplier: '因幡電機', compatibleGroupId: 'KS70系',
    };
    const ks100: TestProduct = {
        id: 3, code: 'KS100', name: 'KS100', stock: 30, minStock: 20,
        cost: 200, supplier: '関東機材', compatibleGroupId: null,
    };
    const ld100: TestProduct = {
        id: 4, code: 'LD100', name: 'LD100', stock: 10, minStock: 20,
        cost: 220, supplier: '因幡電機', compatibleGroupId: 'KS100系',
    };

    const allProducts = [ks70b, ld70, ks100, ld100];

    describe('互換グループ化', () => {
        it('同じcompatibleGroupIdの商品が正しくグループ化される', () => {
            const groups = groupCompatibleProducts(allProducts);
            expect(groups.size).toBe(2); // KS70系 と KS100系
            expect(groups.get('KS70系')).toHaveLength(2);
            expect(groups.get('KS70系')!.map(p => p.code)).toEqual(['KS70B', 'LD70']);
        });

        it('compatibleGroupId未設定の商品はグループに含まれない', () => {
            const groups = groupCompatibleProducts(allProducts);
            const allGrouped = Array.from(groups.values()).flat();
            expect(allGrouped.find(p => p.code === 'KS100')).toBeUndefined();
        });

        it('グループが1つしかない場合も正しく動作', () => {
            const groups = groupCompatibleProducts([ld100]);
            expect(groups.size).toBe(1);
            expect(groups.get('KS100系')!).toHaveLength(1);
        });
    });

    describe('互換品取得', () => {
        it('互換品がある商品から相手を取得できる', () => {
            const compatibles = getCompatibles(ks70b, allProducts);
            expect(compatibles).toHaveLength(1);
            expect(compatibles[0].code).toBe('LD70');
            expect(compatibles[0].supplier).toBe('因幡電機');
        });

        it('互換品がない商品は空配列を返す', () => {
            const compatibles = getCompatibles(ks100, allProducts);
            expect(compatibles).toHaveLength(0);
        });

        it('自分自身は含まれない', () => {
            const compatibles = getCompatibles(ks70b, allProducts);
            expect(compatibles.find(p => p.id === ks70b.id)).toBeUndefined();
        });
    });

    describe('互換品と自動発注の独立性', () => {
        it('互換品がある商品でも個別に自動発注候補になる', () => {
            const pending = new Map<number, number>();
            const drafts = filterOrderCandidates(allProducts, pending);
            // KS70B: 20 < 60 → 候補
            // LD70: 5 < 60 → 候補
            // KS100: 30 >= 20 → 候補外
            // LD100: 10 < 20 → 候補
            expect(drafts).toHaveLength(3);
            expect(drafts.map(p => p.code)).toEqual(['KS70B', 'LD70', 'LD100']);
        });

        it('互換品の在庫を合算しない（独立管理の確認）', () => {
            const modifiedProducts = [
                { ...ks70b, stock: 55 }, // 55 < 60 → 候補
                { ...ld70, stock: 55 },  // 55 < 60 → 候補
            ];
            // 合算するなら55+55=110 > 60 → 候補外のはず
            // 独立管理: 各55 < 60 → 両方候補
            const pending = new Map<number, number>();
            const drafts = filterOrderCandidates(modifiedProducts, pending);
            expect(drafts).toHaveLength(2);
        });

        it('発注済みを考慮しても互換品の発注済みは合算しない', () => {
            const pending = new Map<number, number>();
            pending.set(1, 50); // KS70Bに50個発注済み → 20+50=70 >= 60 → 候補外
            pending.set(2, 0);  // LD70は発注なし → 5+0=5 < 60 → 候補

            const drafts = filterOrderCandidates([ks70b, ld70], pending);
            expect(drafts).toHaveLength(1);
            expect(drafts[0].code).toBe('LD70');
        });
    });

    describe('売値同じ/仕入値違いの確認', () => {
        it('互換品は仕入値が異なり粗利率も異なる', () => {
            const priceA = 114; // 売値は同じ
            const grossMarginKS70 = ((priceA - ks70b.cost) / priceA) * 100;
            const grossMarginLD70 = ((priceA - ld70.cost) / priceA) * 100;

            // KS70B: (114-95)/114 = 16.7%
            expect(grossMarginKS70).toBeCloseTo(16.67, 1);
            // LD70: (114-110)/114 = 3.5%
            expect(grossMarginLD70).toBeCloseTo(3.51, 1);
            // 仕入値が高い方が粗利率が低い
            expect(grossMarginLD70).toBeLessThan(grossMarginKS70);
        });
    });
});
