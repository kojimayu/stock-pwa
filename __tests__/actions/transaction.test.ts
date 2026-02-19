/**
 * 取引処理テスト (transaction.test.ts)
 *
 * テスト対象:
 * - createTransaction: 在庫チェック、正常な取引作成
 * - createReturnFromHistory: 返品バリデーション
 *
 * 注意: サーバーアクションはエラー時に throw ではなく { success: false } を返す設計。
 * そのため異常系テストは rejects.toThrow() ではなく
 * expect(result.success).toBe(false) で検証する。
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createTestVendor,
    createTestVendorUser,
    createTestProduct,
    prisma,
} from '../setup/setup';

// Next.jsサーバー専用APIをモック（テスト環境では動作しない）
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('next-auth', () => ({
    getServerSession: vi.fn().mockResolvedValue(null),
}));

// メール送信をモック（テスト時に実際にメールを送らない）
vi.mock('@/lib/mail', () => ({
    sendTransactionEmail: vi.fn().mockResolvedValue(undefined),
}));

// サーバーアクションをインポート（モック適用後）
const { createTransaction, createReturnFromHistory } =
    await import('@/lib/actions');

describe('createTransaction — 部材チェックアウト', () => {
    it('✅ 正常: 在庫内の数量でチェックアウトできる', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product = await createTestProduct({ stock: 5 });

        const result = await createTransaction(
            vendor.id,
            user.id,
            [{ productId: product.id, quantity: 3, price: 1000, name: product.name }]
        );

        expect(result.success).toBe(true);

        // 在庫が減っているか確認
        const updated = await prisma.product.findUnique({ where: { id: product.id } });
        expect(updated!.stock).toBe(2); // 5 - 3 = 2
    });

    it('❌ 異常: 在庫を超える数量でチェックアウトすると success: false が返る', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product = await createTestProduct({ stock: 2 });

        const result = await createTransaction(vendor.id, user.id, [
            { productId: product.id, quantity: 5, price: 1000, name: product.name },
        ]);

        // createTransaction はエラーをcatchして {success: false} を返す
        expect(result.success).toBe(false);
        expect(result.message).toContain('在庫が不足');
    });

    it('❌ 異常: 在庫0の商品はチェックアウトできない', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product = await createTestProduct({ stock: 0 });

        const result = await createTransaction(vendor.id, user.id, [
            { productId: product.id, quantity: 1, price: 1000, name: product.name },
        ]);

        expect(result.success).toBe(false);
    });

    it('✅ 正常: 手入力商品(isManual)は在庫チェックをスキップする', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);

        const result = await createTransaction(
            vendor.id,
            user.id,
            [{
                productId: 0, // 存在しないID
                quantity: 1,
                price: 500,
                name: '手入力テスト部材',
                isManual: true,
            }]
        );

        expect(result.success).toBe(true);
    });

    it('❌ 異常: 棚卸し中はチェックアウトできない（throwが発生）', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product = await createTestProduct({ stock: 10 });

        // アクティブな棚卸しセッションを作成
        await prisma.inventoryCount.create({
            data: { status: 'IN_PROGRESS', note: 'テスト棚卸し' }
        });

        // checkActiveInventory() は try/catch の外で throw するため
        // {success: false} ではなく throw が伝搬する
        await expect(
            createTransaction(vendor.id, user.id, [
                { productId: product.id, quantity: 1, price: 1000, name: product.name },
            ])
        ).rejects.toThrow('棚卸中');
    });

    it('✅ 正常: 複数商品を同時チェックアウトできる', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product1 = await createTestProduct({ stock: 5, name: '商品A' });
        const product2 = await createTestProduct({ stock: 3, name: '商品B' });

        const result = await createTransaction(
            vendor.id,
            user.id,
            [
                { productId: product1.id, quantity: 2, price: 1000, name: product1.name },
                { productId: product2.id, quantity: 1, price: 2000, name: product2.name },
            ]
        );

        expect(result.success).toBe(true);

        const updated1 = await prisma.product.findUnique({ where: { id: product1.id } });
        const updated2 = await prisma.product.findUnique({ where: { id: product2.id } });
        expect(updated1!.stock).toBe(3);
        expect(updated2!.stock).toBe(2);
    });
});

describe('createReturnFromHistory — 履歴からの返品', () => {
    it('✅ 正常: 返品で在庫が回復する', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product = await createTestProduct({ stock: 3 });

        // まず取引を作成
        await createTransaction(vendor.id, user.id, [
            { productId: product.id, quantity: 2, price: 1000, name: product.name },
        ]);

        const transactions = await prisma.transaction.findMany({
            where: { vendorId: vendor.id },
        });
        const txId = transactions[0].id;

        // 返品
        const result = await createReturnFromHistory(
            txId,
            vendor.id,
            user.id,
            [{ productId: product.id, returnQuantity: 1, name: product.name, price: 1000 }],
            '返品'
        );

        expect(result.success).toBe(true);

        // 在庫が1つ戻っているか（3 - 2 + 1 = 2）
        const updated = await prisma.product.findUnique({ where: { id: product.id } });
        expect(updated!.stock).toBe(2);
    });

    it('❌ 異常: 購入数より多く返品しようとすると success: false が返る', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product = await createTestProduct({ stock: 10 });

        await createTransaction(vendor.id, user.id, [
            { productId: product.id, quantity: 2, price: 1000, name: product.name },
        ]);

        const transactions = await prisma.transaction.findMany({
            where: { vendorId: vendor.id },
        });
        const txId = transactions[0].id;

        // 購入数(2)より多い数量(5)を返品しようとする
        const result = await createReturnFromHistory(
            txId,
            vendor.id,
            user.id,
            [{ productId: product.id, returnQuantity: 5, name: product.name, price: 1000 }],
            '返品'
        );

        expect(result.success).toBe(false);
    });
});
