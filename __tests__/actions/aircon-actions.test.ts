/**
 * エアコンアクションテスト (aircon-actions.test.ts)
 *
 * テスト対象:
 * - getAirconProducts: エアコン商品一覧取得（発注管理用）
 * - checkManagementNoDuplicates: 管理番号重複チェック
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createTestAirconProduct,
    createTestVendor,
    prisma,
} from '../setup/setup';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { getAirconProducts, checkManagementNoDuplicates } = await import('@/lib/aircon-actions');

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

describe('checkManagementNoDuplicates — 管理番号重複チェック', () => {
    it('✅ 正常: 持出しがない管理番号はhasDuplicates=false', async () => {
        const result = await checkManagementNoDuplicates('999999');
        expect(result.hasDuplicates).toBe(false);
        expect(result.logs).toHaveLength(0);
    });

    it('✅ 正常: 持出し済みの管理番号はhasDuplicates=true+ログ情報が返る', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 5 });
        const mgmtNo = `TEST-${Date.now()}`;

        // テスト用ログを直接作成
        await prisma.airConditionerLog.create({
            data: {
                managementNo: mgmtNo,
                modelNumber: product.code,
                vendorId: vendor.id,
                airconProductId: product.id,
                type: 'SET',
            },
        });

        const result = await checkManagementNoDuplicates(mgmtNo);
        expect(result.hasDuplicates).toBe(true);
        expect(result.logs.length).toBe(1);
        expect(result.logs[0].vendorName).toBe(vendor.name);
    });

    it('✅ 正常: INTERNALは常にhasDuplicates=false', async () => {
        const result = await checkManagementNoDuplicates('INTERNAL');
        expect(result.hasDuplicates).toBe(false);
    });

    it('✅ 正常: 返却済み(isReturned=true)のログは除外される', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 5 });
        const mgmtNo = `RET-${Date.now()}`;

        // 返却済みのログを作成
        await prisma.airConditionerLog.create({
            data: {
                managementNo: mgmtNo,
                modelNumber: product.code,
                vendorId: vendor.id,
                airconProductId: product.id,
                type: 'SET',
                isReturned: true,
                returnedAt: new Date(),
            },
        });

        const result = await checkManagementNoDuplicates(mgmtNo);
        expect(result.hasDuplicates).toBe(false);
    });
});

describe('updateAirconMinStock — 最低在庫数更新', () => {
    it('✅ 正常: 最低在庫数を更新できる', async () => {
        const { updateAirconMinStock } = await import('@/lib/aircon-actions');
        const product = await createTestAirconProduct({ stock: 5 });

        const result = await updateAirconMinStock(product.id, 3);
        expect(result.success).toBe(true);

        // 更新を確認
        const updated = await prisma.airconProduct.findUnique({ where: { id: product.id } });
        expect(updated?.minStock).toBe(3);
    });

    it('✅ 正常: minStockを0に設定できる', async () => {
        const { updateAirconMinStock } = await import('@/lib/aircon-actions');
        const product = await createTestAirconProduct({ stock: 5 });

        await updateAirconMinStock(product.id, 5);
        await updateAirconMinStock(product.id, 0);

        const updated = await prisma.airconProduct.findUnique({ where: { id: product.id } });
        expect(updated?.minStock).toBe(0);
    });
});

describe('updateAirconOrderDeliveryDate — 納期回答日更新', () => {
    it('✅ 正常: 納期回答日を設定できる', async () => {
        const { updateAirconOrderDeliveryDate, createAirconOrder } = await import('@/lib/aircon-actions');
        const product = await createTestAirconProduct({ stock: 5 });

        const orderResult = await createAirconOrder(
            [{ productId: product.id, quantity: 2 }]
        );
        expect(orderResult.success).toBe(true);

        const deliveryDate = '2026-03-15';
        const result = await updateAirconOrderDeliveryDate(orderResult.order.id, deliveryDate);
        expect(result.success).toBe(true);

        // 更新を確認
        const updated = await prisma.airconOrder.findUnique({ where: { id: orderResult.order.id } });
        expect(updated?.expectedDeliveryDate).toBeTruthy();
        expect(new Date(updated!.expectedDeliveryDate!).toISOString().split('T')[0]).toBe(deliveryDate);
    });

    it('✅ 正常: 納期回答日をnullにリセットできる', async () => {
        const { updateAirconOrderDeliveryDate, createAirconOrder } = await import('@/lib/aircon-actions');
        const product = await createTestAirconProduct({ stock: 5 });

        const orderResult = await createAirconOrder(
            [{ productId: product.id, quantity: 1 }]
        );

        // 設定→解除
        await updateAirconOrderDeliveryDate(orderResult.order.id, '2026-04-01');
        await updateAirconOrderDeliveryDate(orderResult.order.id, null);

        const updated = await prisma.airconOrder.findUnique({ where: { id: orderResult.order.id } });
        expect(updated?.expectedDeliveryDate).toBeNull();
    });
});
