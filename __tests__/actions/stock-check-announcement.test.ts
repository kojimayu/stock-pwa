/**
 * 在庫確認強化・お知らせテスト (stock-check-announcement.test.ts)
 *
 * テスト対象:
 * - requireStockCheck: 商品のrequireStockCheckフラグが正しく機能するか
 * - SystemConfig: お知らせ文の保存・取得が動作するか
 * - 在庫確認API相当: requireStockCheck商品のstock情報が取得できるか
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createTestProduct,
    prisma,
} from '../setup/setup';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('next-auth', () => ({
    getServerSession: vi.fn().mockResolvedValue(null),
}));

describe('requireStockCheck — 在庫残数チェックフラグ', () => {
    it('✅ 正常: requireStockCheck=true の商品が作成できる', async () => {
        const product = await createTestProduct({
            stock: 5,
            requireStockCheck: true,
        });

        const found = await prisma.product.findUnique({ where: { id: product.id } });
        expect(found!.requireStockCheck).toBe(true);
    });

    it('✅ 正常: デフォルトではrequireStockCheck=false', async () => {
        const product = await createTestProduct({ stock: 5 });

        const found = await prisma.product.findUnique({ where: { id: product.id } });
        expect(found!.requireStockCheck).toBe(false);
    });

    it('✅ 正常: requireStockCheck=trueの商品のみフィルタできる', async () => {
        await createTestProduct({ stock: 5, requireStockCheck: true, name: '要確認商品' });
        await createTestProduct({ stock: 5, requireStockCheck: false, name: '通常商品' });
        await createTestProduct({ stock: 5, requireStockCheck: true, name: '要確認商品2' });

        const checked = await prisma.product.findMany({
            where: { requireStockCheck: true },
        });

        expect(checked.length).toBe(2);
        expect(checked.every(p => p.requireStockCheck)).toBe(true);
    });

    it('✅ 正常: requireStockCheck商品のstock/unit情報を取得できる', async () => {
        const product = await createTestProduct({
            stock: 3,
            requireStockCheck: true,
            unit: '巻',
        });

        // stock-check APIと同等のクエリ
        const result = await prisma.product.findMany({
            where: { id: { in: [product.id] } },
            select: {
                id: true,
                stock: true,
                requireStockCheck: true,
                unit: true,
            },
        });

        expect(result.length).toBe(1);
        expect(result[0].stock).toBe(3);
        expect(result[0].requireStockCheck).toBe(true);
        expect(result[0].unit).toBe('巻');
    });
});

describe('SystemConfig — お知らせ設定', () => {
    it('✅ 正常: お知らせ文を保存できる', async () => {
        await prisma.systemConfig.upsert({
            where: { key: 'kiosk_announcement' },
            update: { value: 'テストお知らせ' },
            create: { key: 'kiosk_announcement', value: 'テストお知らせ' },
        });

        const config = await prisma.systemConfig.findUnique({
            where: { key: 'kiosk_announcement' },
        });
        expect(config?.value).toBe('テストお知らせ');
    });

    it('✅ 正常: お知らせ文を更新できる', async () => {
        await prisma.systemConfig.upsert({
            where: { key: 'kiosk_announcement' },
            update: { value: '初回お知らせ' },
            create: { key: 'kiosk_announcement', value: '初回お知らせ' },
        });

        await prisma.systemConfig.update({
            where: { key: 'kiosk_announcement' },
            data: { value: '更新後お知らせ' },
        });

        const config = await prisma.systemConfig.findUnique({
            where: { key: 'kiosk_announcement' },
        });
        expect(config?.value).toBe('更新後お知らせ');
    });

    it('✅ 正常: お知らせが未設定の場合はnullが返る', async () => {
        const config = await prisma.systemConfig.findUnique({
            where: { key: 'kiosk_announcement' },
        });
        // beforeEachでクリーンされているので見つからない
        expect(config).toBeNull();
    });

    it('✅ 正常: 空文字のお知らせを設定できる', async () => {
        await prisma.systemConfig.upsert({
            where: { key: 'kiosk_announcement' },
            update: { value: '' },
            create: { key: 'kiosk_announcement', value: '' },
        });

        const config = await prisma.systemConfig.findUnique({
            where: { key: 'kiosk_announcement' },
        });
        expect(config?.value).toBe('');
    });
});
