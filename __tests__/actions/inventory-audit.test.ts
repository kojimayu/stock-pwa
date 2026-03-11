/**
 * 在庫監査テスト (inventory-audit.test.ts)
 *
 * テスト対象:
 * - createSpotInventory: スポット棚卸セッション作成
 * - updateInventoryItem: 差異理由付き更新
 * - finalizeInventory: 棚卸確定（差異理由の保持確認）
 * - getDiscrepancyReport: 差異分析レポート
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createTestProduct,
    prisma,
} from '../setup/setup';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/mail', () => ({ sendTransactionEmail: vi.fn() }));

const {
    createSpotInventory,
    updateInventoryItem,
    finalizeInventory,
    cancelInventory,
    getDiscrepancyReport,
} = await import('@/lib/actions');

// 各テスト前に進行中の棚卸をクリーンアップ
beforeEach(async () => {
    await prisma.inventoryCountItem.deleteMany({});
    await prisma.inventoryCount.deleteMany({});
});

// ═══════════════════════════════════════════════════════════════
// 1. スポット棚卸セッション作成
// ═══════════════════════════════════════════════════════════════
describe('createSpotInventory — スポット棚卸セッション', () => {
    it('✅ 正常: 選択した商品のみで棚卸セッションを開始できる', async () => {
        const p1 = await createTestProduct({ stock: 10 });
        const p2 = await createTestProduct({ stock: 5 });
        const p3 = await createTestProduct({ stock: 20 }); // 選択しない

        const inventory = await createSpotInventory([p1.id, p2.id]);

        expect(inventory.type).toBe('SPOT');
        expect(inventory.status).toBe('IN_PROGRESS');

        const items = await prisma.inventoryCountItem.findMany({
            where: { inventoryId: inventory.id },
        });
        expect(items.length).toBe(2);
        // p3は含まれない
        const productIds = items.map(i => i.productId);
        expect(productIds).toContain(p1.id);
        expect(productIds).toContain(p2.id);
        expect(productIds).not.toContain(p3.id);
    });

    it('❌ 異常: 商品未選択でエラー', async () => {
        await expect(createSpotInventory([])).rejects.toThrow('選択');
    });

    it('❌ 異常: 進行中の棚卸があれば開始不可', async () => {
        const p = await createTestProduct({ stock: 5 });
        await createSpotInventory([p.id]);

        const p2 = await createTestProduct({ stock: 3 });
        await expect(createSpotInventory([p2.id])).rejects.toThrow('進行中');
    });
});

// ═══════════════════════════════════════════════════════════════
// 2. 差異理由付き更新
// ═══════════════════════════════════════════════════════════════
describe('updateInventoryItem — 差異理由の保存', () => {
    it('✅ 正常: 差異がある場合にreasonが保存される', async () => {
        const p = await createTestProduct({ stock: 10 });
        const inventory = await createSpotInventory([p.id]);

        const item = await prisma.inventoryCountItem.findFirst({
            where: { inventoryId: inventory.id, productId: p.id },
        });
        expect(item).toBeDefined();

        // 実在庫を7に（差異-3）＋理由
        await updateInventoryItem(item!.id, 7, '記録漏れ');

        const updated = await prisma.inventoryCountItem.findUnique({ where: { id: item!.id } });
        expect(updated!.actualStock).toBe(7);
        expect(updated!.adjustment).toBe(-3);
        expect(updated!.reason).toBe('記録漏れ');
    });

    it('✅ 正常: 差異が0の場合はreasonがnullになる', async () => {
        const p = await createTestProduct({ stock: 10 });
        const inventory = await createSpotInventory([p.id]);

        const item = await prisma.inventoryCountItem.findFirst({
            where: { inventoryId: inventory.id, productId: p.id },
        });

        // 一度差異を作ってreason付き
        await updateInventoryItem(item!.id, 7, '破損・劣化');
        // 差異をゼロに戻す
        await updateInventoryItem(item!.id, 10);

        const updated = await prisma.inventoryCountItem.findUnique({ where: { id: item!.id } });
        expect(updated!.adjustment).toBe(0);
        expect(updated!.reason).toBeNull();
    });

    it('✅ 正常: reason変更が反映される', async () => {
        const p = await createTestProduct({ stock: 10 });
        const inventory = await createSpotInventory([p.id]);

        const item = await prisma.inventoryCountItem.findFirst({
            where: { inventoryId: inventory.id, productId: p.id },
        });

        await updateInventoryItem(item!.id, 8, '数え間違い');
        await updateInventoryItem(item!.id, 8, '紛失・不明');

        const updated = await prisma.inventoryCountItem.findUnique({ where: { id: item!.id } });
        expect(updated!.reason).toBe('紛失・不明');
    });
});

// ═══════════════════════════════════════════════════════════════
// 3. 棚卸確定で在庫が更新される
// ═══════════════════════════════════════════════════════════════
describe('finalizeInventory — スポット棚卸の確定', () => {
    it('✅ 正常: 確定すると在庫が実数に更新される', async () => {
        const p = await createTestProduct({ stock: 10 });
        const inventory = await createSpotInventory([p.id]);

        const item = await prisma.inventoryCountItem.findFirst({
            where: { inventoryId: inventory.id, productId: p.id },
        });
        // 実在庫7（-3不足）
        await updateInventoryItem(item!.id, 7, '紛失・不明');

        const result = await finalizeInventory(inventory.id);
        expect(result.success).toBe(true);

        // 在庫が7に更新
        const updatedProduct = await prisma.product.findUnique({ where: { id: p.id } });
        expect(updatedProduct!.stock).toBe(7);

        // セッションがCOMPLETED
        const session = await prisma.inventoryCount.findUnique({ where: { id: inventory.id } });
        expect(session!.status).toBe('COMPLETED');
    });

    it('✅ 正常: 中止しても在庫は変動しない', async () => {
        const p = await createTestProduct({ stock: 10 });
        const inventory = await createSpotInventory([p.id]);

        const item = await prisma.inventoryCountItem.findFirst({
            where: { inventoryId: inventory.id, productId: p.id },
        });
        await updateInventoryItem(item!.id, 5, '破損・劣化');

        await cancelInventory(inventory.id);

        // 在庫は10のまま
        const updatedProduct = await prisma.product.findUnique({ where: { id: p.id } });
        expect(updatedProduct!.stock).toBe(10);
    });
});

// ═══════════════════════════════════════════════════════════════
// 4. 差異分析レポート
// ═══════════════════════════════════════════════════════════════
describe('getDiscrepancyReport — 差異分析レポート', () => {
    it('✅ 正常: 差異データがない場合は空レポート', async () => {
        const report = await getDiscrepancyReport(1);

        expect(report.summary.totalDiscrepancies).toBe(0);
        expect(report.summary.realLoss).toBe(0);
        expect(report.lossTop.length).toBe(0);
        expect(report.rateTop.length).toBe(0);
        expect(report.reasonBreakdown.length).toBe(0);
    });

    it('✅ 正常: 紛失・破損は実損金額に含まれる', async () => {
        const p = await createTestProduct({ stock: 10, cost: 100 });
        const inventory = await createSpotInventory([p.id]);

        const item = await prisma.inventoryCountItem.findFirst({
            where: { inventoryId: inventory.id, productId: p.id },
        });
        // -3不足 × 100円仕入 = 300円実損
        await updateInventoryItem(item!.id, 7, '紛失・不明');
        await finalizeInventory(inventory.id);

        const report = await getDiscrepancyReport(1);

        expect(report.summary.totalDiscrepancies).toBe(1);
        expect(report.summary.realLoss).toBe(300); // 紛失は実損
        expect(report.summary.resolvedLoss).toBe(0);
        expect(report.lossTop.length).toBe(1);
        expect(report.lossTop[0].productName).toBe(p.name);
        expect(report.reasonBreakdown.length).toBe(1);
        expect(report.reasonBreakdown[0].reason).toBe('紛失・不明');
        expect(report.reasonBreakdown[0].isRealLoss).toBe(true);
    });

    it('✅ 正常: 記録漏れ等は原因判明分に分類され実損に含まれない', async () => {
        const p = await createTestProduct({ stock: 5, cost: 200 });
        const inventory = await createSpotInventory([p.id]);

        const item = await prisma.inventoryCountItem.findFirst({
            where: { inventoryId: inventory.id, productId: p.id },
        });
        // +2過剰 → 記録漏れ
        await updateInventoryItem(item!.id, 7, '記録漏れ');
        await finalizeInventory(inventory.id);

        const report = await getDiscrepancyReport(1);

        expect(report.summary.totalExcessAmount).toBe(400); // 2 × 200
        expect(report.summary.realLoss).toBe(0); // 記録漏れは実損ではない
        expect(report.lossTop.length).toBe(0);   // 実損TOPには出ない
    });

    it('✅ 正常: 中止した棚卸はレポートに含まれない', async () => {
        const p = await createTestProduct({ stock: 10, cost: 100 });
        const inventory = await createSpotInventory([p.id]);

        const item = await prisma.inventoryCountItem.findFirst({
            where: { inventoryId: inventory.id, productId: p.id },
        });
        await updateInventoryItem(item!.id, 5, '紛失・不明');
        await cancelInventory(inventory.id);

        const report = await getDiscrepancyReport(1);
        expect(report.summary.totalDiscrepancies).toBe(0);
    });
});

