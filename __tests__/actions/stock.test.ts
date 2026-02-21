/**
 * 在庫管理テスト (stock.test.ts)
 *
 * テスト対象:
 * - adjustStock: 在庫手動調整
 * - createInventoryCount / cancelInventory: 棚卸し
 * - エアコン在庫（DBレベル確認）
 *
 * 既知の仕様:
 * - adjustStock は現状「超過出庫」を許してしまう（在庫チェックなし）→ TODO
 * - createInventoryCount は重複開始を防がない → TODO
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createTestProduct,
    createTestAirconProduct,
    prisma,
} from '../setup/setup';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/mail', () => ({ sendTransactionEmail: vi.fn() }));

const { adjustStock, createInventoryCount, cancelInventory } =
    await import('@/lib/actions');

describe('adjustStock — 在庫手動調整', () => {
    it('✅ 正常: 在庫を増やせる（入庫）', async () => {
        const product = await createTestProduct({ stock: 5 });

        await adjustStock(product.id, 'IN', 3, 'テスト入庫');

        const updated = await prisma.product.findUnique({ where: { id: product.id } });
        expect(updated!.stock).toBe(8); // 5 + 3 = 8
    });

    it('✅ 正常: 在庫を減らせる（出庫）', async () => {
        const product = await createTestProduct({ stock: 10 });

        await adjustStock(product.id, 'OUT', 4, 'テスト出庫');

        const updated = await prisma.product.findUnique({ where: { id: product.id } });
        expect(updated!.stock).toBe(6); // 10 - 4 = 6
    });

    it('❌ 異常: 在庫を超える出庫はエラーになる', async () => {
        const product = await createTestProduct({ stock: 3 });

        await expect(
            adjustStock(product.id, 'OUT', 5, 'テスト超過出庫')
        ).rejects.toThrow('在庫不足');

        // 在庫は変わっていないこと
        const updated = await prisma.product.findUnique({ where: { id: product.id } });
        expect(updated!.stock).toBe(3);
    });

    it('✅ 正常: 在庫調整はInventoryLogに記録される', async () => {
        const product = await createTestProduct({ stock: 5 });

        await adjustStock(product.id, 'IN', 2, '記録テスト');

        const logs = await prisma.inventoryLog.findMany({
            where: { productId: product.id },
        });
        expect(logs.length).toBe(1);
        expect(logs[0].type).toBe('IN');
        expect(logs[0].quantity).toBe(2);
        expect(logs[0].reason).toBe('記録テスト');
    });
});

describe('棚卸し — InventoryCount', () => {
    it('✅ 正常: 棚卸しセッションを開始できる', async () => {
        const inventory = await createInventoryCount('テスト棚卸し');
        // createInventoryCount returns the created InventoryCount object
        expect(inventory).toBeDefined();
        expect(inventory.status).toBe('IN_PROGRESS');
        expect(inventory.note).toBe('テスト棚卸し');
    });

    it('❌ 異常: 進行中の棚卸しがある場合は新規開始できない', async () => {
        await createInventoryCount('1回目の棚卸し');

        // 2回目の開始はエラーになること
        await expect(
            createInventoryCount('2回目の棚卸し')
        ).rejects.toThrow('進行中');
    });

    it('✅ 正常: 棚卸しをキャンセルできる', async () => {
        await createInventoryCount('キャンセルテスト');
        const countId = (await prisma.inventoryCount.findFirst({ where: { status: 'IN_PROGRESS' } }))!.id;

        // cancelInventory returns void — just check it doesn't throw
        await expect(cancelInventory(countId)).resolves.not.toThrow();

        const count = await prisma.inventoryCount.findUnique({ where: { id: countId } });
        expect(count!.status).toBe('CANCELLED');
    });
});

describe('エアコン在庫（DBレベル確認）', () => {
    it('✅ 正常: 在庫があるエアコン商品が正しく作成できる', async () => {
        const aircon = await createTestAirconProduct({ stock: 3 });

        const found = await prisma.airconProduct.findUnique({ where: { id: aircon.id } });
        expect(found!.stock).toBe(3);
        expect(found!.code).toBe(aircon.code);
    });

    it('✅ 正常: 在庫0のエアコンはDBに存在できる（在庫切れ商品）', async () => {
        const aircon = await createTestAirconProduct({ stock: 0 });

        const found = await prisma.airconProduct.findUnique({ where: { id: aircon.id } });
        expect(found!.stock).toBe(0);
    });
});
