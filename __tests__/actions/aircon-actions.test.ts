/**
 * エアコンアクションテスト (aircon-actions.test.ts)
 *
 * テスト対象:
 * - getAirconProducts: エアコン商品一覧取得（発注管理用）
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createTestAirconProduct,
    prisma,
} from '../setup/setup';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { getAirconProducts } = await import('@/lib/aircon-actions');

describe('getAirconProducts — エアコン商品一覧取得', () => {
    it('✅ 正常: エアコン商品の一覧を取得できる', async () => {
        // テストデータ作成
        await createTestAirconProduct({ stock: 5 });
        await createTestAirconProduct({ stock: 3 });

        const products = await getAirconProducts();

        // 最低2件以上取得できること
        expect(products.length).toBeGreaterThanOrEqual(2);
    });

    it('✅ 正常: 取得結果にid, code, stock等の必須フィールドが含まれる', async () => {
        await createTestAirconProduct({ stock: 10 });

        const products = await getAirconProducts();
        const product = products[0];

        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('code');
        expect(product).toHaveProperty('stock');
        expect(product).toHaveProperty('name');
    });

    it('✅ 正常: 結果がcodeの昇順でソートされている', async () => {
        const products = await getAirconProducts();

        if (products.length >= 2) {
            for (let i = 1; i < products.length; i++) {
                expect(products[i].code >= products[i - 1].code).toBe(true);
            }
        }
    });
});
