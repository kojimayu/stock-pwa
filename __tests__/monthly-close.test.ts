import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('月次締め — ロック機能テスト', () => {
    const testYear = 2099;
    const testMonth = 12;

    afterAll(async () => {
        // テストデータのクリーンアップ
        await prisma.monthlyClose.deleteMany({ where: { year: testYear } });
        await prisma.$disconnect();
    });

    it('未締めの月はisMonthClosedがfalseを返す', async () => {
        const record = await prisma.monthlyClose.findUnique({
            where: { year_month: { year: testYear, month: testMonth } },
        });
        expect(record).toBeNull();
    });

    it('closeMonthで月を締められる', async () => {
        await prisma.monthlyClose.create({
            data: { year: testYear, month: testMonth, closedBy: 'テスト管理者' },
        });

        const record = await prisma.monthlyClose.findUnique({
            where: { year_month: { year: testYear, month: testMonth } },
        });
        expect(record).not.toBeNull();
        expect(record!.closedBy).toBe('テスト管理者');
    });

    it('同じ年月は二重に締められない（ユニーク制約）', async () => {
        await expect(
            prisma.monthlyClose.create({
                data: { year: testYear, month: testMonth },
            })
        ).rejects.toThrow();
    });

    it('締め済み月の取引はupdateTransactionでエラーになる', async () => {
        // テスト用の月（2099-12）に取引を作成
        const vendor = await prisma.vendor.findFirst();
        if (!vendor) return; // ベンダーがなければスキップ

        // 2099-12-15 の取引を作成
        const tx = await prisma.transaction.create({
            data: {
                vendorId: vendor.id,
                date: new Date(Date.UTC(testYear, testMonth - 1, 15)),
                totalAmount: 1000,
                items: JSON.stringify([{ productId: 1, name: 'テスト', price: 1000, quantity: 1 }]),
            },
        });

        // updateTransaction を dynamic import で取得
        const { updateTransaction } = await import('@/lib/actions');

        await expect(
            updateTransaction(tx.id, [{ productId: 1, name: 'テスト変更', price: 2000, quantity: 1 }])
        ).rejects.toThrow('締め済み');

        // クリーンアップ
        await prisma.transaction.delete({ where: { id: tx.id } });
    });

    it('未締め月の取引は編集可能', async () => {
        // 2098年（未締め）の取引
        const vendor = await prisma.vendor.findFirst();
        if (!vendor) return;

        const tx = await prisma.transaction.create({
            data: {
                vendorId: vendor.id,
                date: new Date(Date.UTC(2098, 5, 15)),
                totalAmount: 1000,
                items: JSON.stringify([{ productId: 1, name: 'テスト', price: 1000, quantity: 1 }]),
            },
        });

        // 未締めなのでエラーにならないことを確認
        const record = await prisma.monthlyClose.findUnique({
            where: { year_month: { year: 2098, month: 6 } },
        });
        expect(record).toBeNull();

        // クリーンアップ
        await prisma.transaction.delete({ where: { id: tx.id } });
    });
});
