/**
 * エアコン買取 × 取引の在庫連動テスト
 *
 * テスト対象:
 * - createTransaction: エアコン商品のcheckout時にAirconProductも減算される
 * - updateTransaction: エアコン商品の削除/数量変更時にAirconProductも連動する
 * - returnTransaction: 全量戻し時にAirconProductも連動 + PURCHASEログも戻し済み
 * - returnAircon: PURCHASEタイプではAirconProduct在庫を変更しない
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createTestVendor,
    createTestVendorUser,
    prisma,
} from '../setup/setup';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/mail', () => ({ sendTransactionEmail: vi.fn() }));

const {
    createTransaction,
    updateTransaction,
    returnTransaction,
} = await import('@/lib/actions');

const { returnAircon } = await import('@/lib/aircon-actions');

// テスト用エアコン商品を作成（Product + AirconProduct 紐付き）
async function createTestAirconProduct(stock = 10) {
    const aircon = await prisma.airconProduct.create({
        data: {
            code: `AC-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            name: 'テストエアコン',
            capacity: '3.6kw',
            stock,
        }
    });
    const product = await prisma.product.create({
        data: {
            code: `PROD-AC-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            name: 'テストエアコン本体',
            category: 'エアコン',
            priceA: 70000,
            priceB: 70000,
            priceC: 70000,
            cost: 50000,
            stock,
            minStock: 1,
            airconProductId: aircon.id,
        }
    });
    return { product, aircon };
}

// クリーンアップ
beforeEach(async () => {
    await prisma.inventoryLog.deleteMany({});
    await prisma.airConditionerLog.deleteMany({});
    await prisma.transaction.deleteMany({});
});

// ═══════════════════════════════════════════════════════════════
// 1. createTransaction → AirconProduct連動
// ═══════════════════════════════════════════════════════════════
describe('createTransaction — エアコン在庫連動', () => {
    it('✅ checkout時にAirconProductも減算される', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const { product, aircon } = await createTestAirconProduct(20);

        await createTransaction(
            vendor.id,
            user.id,
            [{ productId: product.id, quantity: 3, price: 70000, name: product.name, code: product.code }],
            210000,
            false
        );

        // Product在庫 -3
        const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
        expect(updatedProduct!.stock).toBe(17);

        // AirconProduct在庫も -3
        const updatedAircon = await prisma.airconProduct.findUnique({ where: { id: aircon.id } });
        expect(updatedAircon!.stock).toBe(17);

        // PURCHASEログが1件作成される
        const purchaseLog = await prisma.airConditionerLog.findFirst({
            where: { airconProductId: aircon.id, type: 'PURCHASE' }
        });
        expect(purchaseLog).toBeDefined();
        expect(purchaseLog!.isReturned).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// 2. updateTransaction — エアコン在庫連動
// ═══════════════════════════════════════════════════════════════
describe('updateTransaction — エアコン在庫連動', () => {
    it('✅ エアコン商品を削除するとAirconProductも戻る', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const { product, aircon } = await createTestAirconProduct(20);

        const tx = await createTransaction(
            vendor.id, user.id,
            [{ productId: product.id, quantity: 4, price: 70000, name: product.name, code: product.code }],
            280000, false
        );

        // 最新のTransactionを取得
        const createdTx = await prisma.transaction.findFirst({ orderBy: { id: 'desc' } });

        // 編集: エアコンを削除（空の明細に）
        await updateTransaction(createdTx!.id, []);

        // Product在庫 戻る
        const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
        expect(updatedProduct!.stock).toBe(20);

        // AirconProduct在庫も戻る
        const updatedAircon = await prisma.airconProduct.findUnique({ where: { id: aircon.id } });
        expect(updatedAircon!.stock).toBe(20);
    });

    it('✅ エアコン数量を減らすとAirconProductも連動', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const { product, aircon } = await createTestAirconProduct(20);

        const tx = await createTransaction(
            vendor.id, user.id,
            [{ productId: product.id, quantity: 6, price: 70000, name: product.name, code: product.code }],
            420000, false
        );

        const createdTx = await prisma.transaction.findFirst({ orderBy: { id: 'desc' } });

        // 編集: 6台→2台に変更
        await updateTransaction(createdTx!.id, [
            { productId: product.id, quantity: 2, price: 70000, name: product.name, code: product.code }
        ]);

        // Product在庫: 20 - 6 + 4 = 18 (4台分戻る)
        const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
        expect(updatedProduct!.stock).toBe(18);

        // AirconProduct在庫も同じ
        const updatedAircon = await prisma.airconProduct.findUnique({ where: { id: aircon.id } });
        expect(updatedAircon!.stock).toBe(18);
    });
});

// ═══════════════════════════════════════════════════════════════
// 3. returnTransaction — エアコン在庫連動
// ═══════════════════════════════════════════════════════════════
describe('returnTransaction — エアコン在庫連動', () => {
    it('✅ 全量戻しでAirconProductも戻る + PURCHASEログも戻し済みに', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const { product, aircon } = await createTestAirconProduct(20);

        const tx = await createTransaction(
            vendor.id, user.id,
            [{ productId: product.id, quantity: 5, price: 70000, name: product.name, code: product.code }],
            350000, false
        );

        const createdTx = await prisma.transaction.findFirst({ orderBy: { id: 'desc' } });

        // 全量戻し
        const result = await returnTransaction(createdTx!.id);
        expect(result.success).toBe(true);

        // Product在庫 戻る
        const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
        expect(updatedProduct!.stock).toBe(20);

        // AirconProduct在庫も戻る
        const updatedAircon = await prisma.airconProduct.findUnique({ where: { id: aircon.id } });
        expect(updatedAircon!.stock).toBe(20);

        // PURCHASEログが戻し済み
        const purchaseLog = await prisma.airConditionerLog.findFirst({
            where: { airconProductId: aircon.id, type: 'PURCHASE' }
        });
        expect(purchaseLog!.isReturned).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════
// 4. returnAircon — PURCHASEタイプの在庫挙動
// ═══════════════════════════════════════════════════════════════
describe('returnAircon — PURCHASEタイプ', () => {
    it('✅ PURCHASEタイプの戻しではAirconProduct在庫を変更しない', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const { product, aircon } = await createTestAirconProduct(20);

        const tx = await createTransaction(
            vendor.id, user.id,
            [{ productId: product.id, quantity: 2, price: 70000, name: product.name, code: product.code }],
            140000, false
        );

        // AirconProduct: 20→18
        const afterCheckout = await prisma.airconProduct.findUnique({ where: { id: aircon.id } });
        expect(afterCheckout!.stock).toBe(18);

        // PURCHASEログを取得して戻す
        const purchaseLog = await prisma.airConditionerLog.findFirst({
            where: { airconProductId: aircon.id, type: 'PURCHASE', isReturned: false }
        });
        expect(purchaseLog).toBeDefined();

        const result = await returnAircon(purchaseLog!.id);
        expect(result.success).toBe(true);

        // AirconProduct在庫は変わらない（PURCHASEは在庫変動しない）
        const afterReturn = await prisma.airconProduct.findUnique({ where: { id: aircon.id } });
        expect(afterReturn!.stock).toBe(18); // 18のまま変わらない

        // ただしログは戻し済みに
        const updatedLog = await prisma.airConditionerLog.findUnique({ where: { id: purchaseLog!.id } });
        expect(updatedLog!.isReturned).toBe(true);
    });
});
