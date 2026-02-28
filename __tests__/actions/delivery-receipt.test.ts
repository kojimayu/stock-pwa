import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
});

describe('納品記録 (DeliveryReceipt)', () => {
    let receiptId: number;

    afterAll(async () => {
        // テストデータクリーンアップ
        if (receiptId) {
            await prisma.deliveryReceipt.delete({ where: { id: receiptId } }).catch(() => { });
        }
        await prisma.$disconnect();
    });

    it('納品記録を作成できる（材料）', async () => {
        const receipt = await prisma.deliveryReceipt.create({
            data: {
                type: 'MATERIAL',
                orderId: 9999, // テスト用ダミーID
                confirmedBy: 'test@example.com',
                confirmedAt: new Date(),
                deliveryDate: new Date('2026-02-28'),
                note: 'テスト納品記録',
            },
        });

        receiptId = receipt.id;
        expect(receipt.id).toBeGreaterThan(0);
        expect(receipt.type).toBe('MATERIAL');
        expect(receipt.confirmedBy).toBe('test@example.com');
        expect(receipt.note).toBe('テスト納品記録');
    });

    it('納品記録を取得できる', async () => {
        const receipts = await prisma.deliveryReceipt.findMany({
            where: { type: 'MATERIAL', orderId: 9999 },
        });

        expect(receipts.length).toBeGreaterThanOrEqual(1);
        const found = receipts.find(r => r.id === receiptId);
        expect(found).toBeTruthy();
        expect(found!.confirmedBy).toBe('test@example.com');
    });

    it('写真パスをnullで作成できる', async () => {
        const receipt = await prisma.deliveryReceipt.create({
            data: {
                type: 'AIRCON',
                orderId: 9998,
                confirmedBy: 'admin',
                confirmedAt: new Date(),
            },
        });

        expect(receipt.photoPath).toBeNull();
        expect(receipt.deliveryDate).toBeNull();
        expect(receipt.note).toBeNull();

        // クリーンアップ
        await prisma.deliveryReceipt.delete({ where: { id: receipt.id } });
    });

    it('写真パスを含む納品記録を作成できる', async () => {
        const receipt = await prisma.deliveryReceipt.create({
            data: {
                type: 'AIRCON',
                orderId: 9997,
                photoPath: '/uploads/delivery-receipts/aircon_9997_1234567890.jpg',
                confirmedBy: 'admin@example.com',
                confirmedAt: new Date(),
                deliveryDate: new Date('2026-03-01'),
                note: '写真付き確認',
            },
        });

        expect(receipt.photoPath).toBe('/uploads/delivery-receipts/aircon_9997_1234567890.jpg');

        // クリーンアップ
        await prisma.deliveryReceipt.delete({ where: { id: receipt.id } });
    });
});
