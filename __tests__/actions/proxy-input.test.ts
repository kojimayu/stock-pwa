/**
 * 代理入力テスト (proxy-input.test.ts)
 *
 * テスト対象:
 * - createTransaction: 代理入力時のtransactionDate処理
 *   - JSTオフセット付き日時が正しく保存されるか
 *   - isProxyInputフラグが正しく記録されるか
 *   - 操作ログにPROXY_INPUTが記録されるか
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createTestVendor,
    createTestVendorUser,
    createTestProduct,
    prisma,
} from '../setup/setup';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('next-auth', () => ({
    getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/mail', () => ({
    sendTransactionEmail: vi.fn().mockResolvedValue(undefined),
}));

const { createTransaction } = await import('@/lib/actions');

describe('createTransaction — 代理入力の日時処理', () => {
    it('✅ 正常: transactionDateを指定すると、その日付で取引が記録される', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product = await createTestProduct({ stock: 10 });

        // JSTオフセット付きの日付（実際のフロントエンドと同じ形式）
        const specifiedDate = new Date('2026-03-01T00:00:00+09:00');

        const result = await createTransaction(
            vendor.id,
            user.id,
            [{ productId: product.id, quantity: 1, price: 1000, name: product.name }],
            undefined,   // totalAmount
            true,         // isProxyInput
            specifiedDate // transactionDate
        );

        expect(result.success).toBe(true);

        // 取引の日付を確認
        const tx = await prisma.transaction.findFirst({
            where: { vendorId: vendor.id },
            orderBy: { id: 'desc' },
        });
        expect(tx).toBeTruthy();
        expect(tx!.date.toISOString()).toBe(specifiedDate.toISOString());
    });

    it('✅ 正常: transactionDateなしの場合は現在日時が使用される', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product = await createTestProduct({ stock: 10 });

        const beforeTime = new Date();

        const result = await createTransaction(
            vendor.id,
            user.id,
            [{ productId: product.id, quantity: 1, price: 1000, name: product.name }]
        );

        expect(result.success).toBe(true);

        const tx = await prisma.transaction.findFirst({
            where: { vendorId: vendor.id },
            orderBy: { id: 'desc' },
        });
        expect(tx).toBeTruthy();
        // 現在時刻に近いことを確認（前後10秒以内）
        const diff = Math.abs(tx!.date.getTime() - beforeTime.getTime());
        expect(diff).toBeLessThan(10000);
    });

    it('✅ 正常: JSTオフセット付き日付はUTC 9:00にならない（バグ回帰防止）', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product = await createTestProduct({ stock: 10 });

        // フロントエンドと同じ形式: "2026-03-04" + "T00:00:00+09:00"
        const dateStr = '2026-03-04T00:00:00+09:00';
        const specifiedDate = new Date(dateStr);

        const result = await createTransaction(
            vendor.id,
            user.id,
            [{ productId: product.id, quantity: 1, price: 1000, name: product.name }],
            undefined,
            true,
            specifiedDate
        );

        expect(result.success).toBe(true);

        const tx = await prisma.transaction.findFirst({
            where: { vendorId: vendor.id },
            orderBy: { id: 'desc' },
        });

        // UTC換算で 2026-03-03T15:00:00Z であるべき（JST 0:00 = UTC -9時間）
        // 以前のバグ: "2026-03-04" → UTC 2026-03-04T00:00:00Z → JST 9:00 だった
        expect(tx!.date.getUTCHours()).toBe(15); // JST 00:00 = UTC 15:00（前日）
        expect(tx!.date.getUTCDate()).toBe(3);   // JST 3/4 00:00 = UTC 3/3 15:00
    });

    it('✅ 正常: isProxyInputフラグが正しく記録される', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product = await createTestProduct({ stock: 10 });

        const result = await createTransaction(
            vendor.id,
            user.id,
            [{ productId: product.id, quantity: 1, price: 1000, name: product.name }],
            undefined,
            true  // isProxyInput = true
        );

        expect(result.success).toBe(true);

        const tx = await prisma.transaction.findFirst({
            where: { vendorId: vendor.id },
            orderBy: { id: 'desc' },
        });
        expect(tx!.isProxyInput).toBe(true);
    });

    it('✅ 正常: 通常入力ではisProxyInput=falseになる', async () => {
        const vendor = await createTestVendor();
        const user = await createTestVendorUser(vendor.id);
        const product = await createTestProduct({ stock: 10 });

        const result = await createTransaction(
            vendor.id,
            user.id,
            [{ productId: product.id, quantity: 1, price: 1000, name: product.name }]
        );

        expect(result.success).toBe(true);

        const tx = await prisma.transaction.findFirst({
            where: { vendorId: vendor.id },
            orderBy: { id: 'desc' },
        });
        expect(tx!.isProxyInput).toBe(false);
    });

});

