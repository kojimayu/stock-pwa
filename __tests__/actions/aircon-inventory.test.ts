/**
 * エアコン棚卸テスト (aircon-inventory.test.ts)
 *
 * テスト対象:
 * - createAirconInventory: 棚卸セッション開始
 * - updateAirconInventoryItem: 実数更新
 * - completeAirconInventory: 棚卸確定（在庫反映）
 * - cancelAirconInventory: 棚卸中止
 * - getActiveAirconInventory: 進行中セッション取得
 * - getAirconInventoryHistory: 棚卸履歴取得
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createTestAirconProduct,
    prisma,
} from '../setup/setup';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const {
    createAirconInventory,
    updateAirconInventoryItem,
    completeAirconInventory,
    cancelAirconInventory,
    getActiveAirconInventory,
    getAirconInventoryHistory,
} = await import('@/lib/aircon-actions');

// 各テスト前に進行中の棚卸をクリーンアップ
beforeEach(async () => {
    await prisma.airconInventoryCountItem.deleteMany({});
    await prisma.airconInventoryCount.deleteMany({});
});

describe('createAirconInventory — 棚卸セッション開始', () => {
    it('✅ 正常: 棚卸セッションを作成できる', async () => {
        await createTestAirconProduct({ stock: 5 });

        const result = await createAirconInventory('テスト棚卸');
        expect(result.success).toBe(true);
        expect(result.inventory).toBeDefined();
        expect(result.inventory!.status).toBe('IN_PROGRESS');
        expect(result.inventory!.note).toBe('テスト棚卸');
        expect(result.inventory!.items.length).toBeGreaterThanOrEqual(1);
    });

    it('✅ 正常: 開始時にシステム在庫がスナップショットされる', async () => {
        const product = await createTestAirconProduct({ stock: 7 });

        const result = await createAirconInventory();
        const item = result.inventory!.items.find(i => i.productId === product.id);

        expect(item).toBeDefined();
        expect(item!.expectedStock).toBe(7);
        expect(item!.actualStock).toBe(7); // デフォルトはexpectedと同じ
        expect(item!.adjustment).toBe(0);
    });

    it('❌ 異常: 進行中の棚卸がある場合は新規作成できない', async () => {
        await createTestAirconProduct();
        await createAirconInventory();

        const result = await createAirconInventory();
        expect(result.success).toBe(false);
        expect(result.message).toContain('進行中');
    });
});

describe('updateAirconInventoryItem — 実数更新', () => {
    it('✅ 正常: 実数を更新すると差異が計算される', async () => {
        const product = await createTestAirconProduct({ stock: 10 });
        const result = await createAirconInventory();
        const item = result.inventory!.items.find(i => i.productId === product.id)!;

        const updateResult = await updateAirconInventoryItem(item.id, 8);
        expect(updateResult.success).toBe(true);

        // DBを直接確認
        const updated = await prisma.airconInventoryCountItem.findUnique({ where: { id: item.id } });
        expect(updated!.actualStock).toBe(8);
        expect(updated!.adjustment).toBe(-2); // 8 - 10 = -2
    });

    it('✅ 正常: 在庫が増える差異も正しく計算される', async () => {
        const product = await createTestAirconProduct({ stock: 3 });
        const result = await createAirconInventory();
        const item = result.inventory!.items.find(i => i.productId === product.id)!;

        await updateAirconInventoryItem(item.id, 5);

        const updated = await prisma.airconInventoryCountItem.findUnique({ where: { id: item.id } });
        expect(updated!.adjustment).toBe(2); // 5 - 3 = +2
    });
});

describe('completeAirconInventory — 棚卸確定', () => {
    it('✅ 正常: 確定すると在庫が実数に更新される', async () => {
        const product = await createTestAirconProduct({ stock: 10 });
        const result = await createAirconInventory();
        const item = result.inventory!.items.find(i => i.productId === product.id)!;

        // 実数を8に変更
        await updateAirconInventoryItem(item.id, 8);

        // 確定
        const completeResult = await completeAirconInventory(result.inventory!.id, 'テスト太郎');
        expect(completeResult.success).toBe(true);

        // 在庫が更新されていることを確認
        const updatedProduct = await prisma.airconProduct.findUnique({ where: { id: product.id } });
        expect(updatedProduct!.stock).toBe(8);

        // セッションのステータスが完了になっていること
        const session = await prisma.airconInventoryCount.findUnique({ where: { id: result.inventory!.id } });
        expect(session!.status).toBe('COMPLETED');
        expect(session!.confirmedBy).toBe('テスト太郎');
        expect(session!.endedAt).toBeDefined();
    });

    it('❌ 異常: 完了済みの棚卸は二重確定できない', async () => {
        await createTestAirconProduct();
        const result = await createAirconInventory();
        await completeAirconInventory(result.inventory!.id, 'A');

        const secondResult = await completeAirconInventory(result.inventory!.id, 'B');
        expect(secondResult.success).toBe(false);
    });
});

describe('cancelAirconInventory — 棚卸中止', () => {
    it('✅ 正常: 中止しても在庫は変更されない', async () => {
        const product = await createTestAirconProduct({ stock: 10 });
        const result = await createAirconInventory();
        const item = result.inventory!.items.find(i => i.productId === product.id)!;

        // 実数を変更してから中止
        await updateAirconInventoryItem(item.id, 5);
        const cancelResult = await cancelAirconInventory(result.inventory!.id);
        expect(cancelResult.success).toBe(true);

        // 在庫は元のまま
        const updatedProduct = await prisma.airconProduct.findUnique({ where: { id: product.id } });
        expect(updatedProduct!.stock).toBe(10);

        // ステータスがCANCELLED
        const session = await prisma.airconInventoryCount.findUnique({ where: { id: result.inventory!.id } });
        expect(session!.status).toBe('CANCELLED');
    });
});

describe('getActiveAirconInventory & getAirconInventoryHistory', () => {
    it('✅ 正常: 進行中の棚卸を取得できる', async () => {
        await createTestAirconProduct();
        await createAirconInventory('テスト');

        const active = await getActiveAirconInventory();
        expect(active).toBeDefined();
        expect(active!.status).toBe('IN_PROGRESS');
    });

    it('✅ 正常: 完了後は進行中がnullになる', async () => {
        await createTestAirconProduct();
        const result = await createAirconInventory();
        await completeAirconInventory(result.inventory!.id, 'テスト');

        const active = await getActiveAirconInventory();
        expect(active).toBeNull();
    });

    it('✅ 正常: 棚卸履歴を取得できる', async () => {
        await createTestAirconProduct();
        const result = await createAirconInventory();
        await completeAirconInventory(result.inventory!.id, 'テスト');

        const history = await getAirconInventoryHistory();
        expect(history.length).toBeGreaterThanOrEqual(1);
        expect(history[0].status).toBe('COMPLETED');
        expect(history[0].confirmedBy).toBe('テスト');
    });
});
