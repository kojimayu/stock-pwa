/**
 * 新機能テスト: 一時貸出・在庫セット表示・引当変更
 *
 * テスト対象:
 * - getAirconStockWithVendorBreakdown: 一時貸出フラグによる業者持出しカウント
 * - updateAirconLogAssignment: 引当変更+一時貸出フラグ更新
 * - returnAircon: 戻し処理
 * - ログAPIの managementNo フィルター
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createTestAirconProduct,
    createTestVendor,
    prisma,
} from '../setup/setup';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const {
    getAirconStockWithVendorBreakdown,
    updateAirconLogAssignment,
    returnAircon,
} = await import('@/lib/aircon-actions');

// ── ヘルパー: テスト用エアコンログを作成 ──
async function createTestLog(opts: {
    vendorId: number;
    productId: number;
    modelNumber: string;
    managementNo?: string;
    type?: string;
    isTemporaryLoan?: boolean;
    isReturned?: boolean;
}) {
    return prisma.airConditionerLog.create({
        data: {
            managementNo: opts.managementNo || 'INTERNAL',
            modelNumber: opts.modelNumber,
            vendorId: opts.vendorId,
            airconProductId: opts.productId,
            type: opts.type || 'SET',
            isTemporaryLoan: opts.isTemporaryLoan || false,
            isReturned: opts.isReturned || false,
        },
    });
}

// ═══════════════════════════════════════════════════════════════
// 1. 一時貸出フラグ (isTemporaryLoan)
// ═══════════════════════════════════════════════════════════════
describe('一時貸出フラグ — getAirconStockWithVendorBreakdown', () => {
    it('✅ 管理Noなしのログは業者持出しにカウントされる', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 10 });

        await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
            managementNo: undefined, // INTERNAL
            type: 'SET',
        });

        const results = await getAirconStockWithVendorBreakdown();
        const p = results.find((r: any) => r.id === product.id);

        expect(p).toBeDefined();
        expect(p.vendorStock).toBe(1);
        expect(p.typeBreakdown.set).toBe(1);
    });

    it('✅ 管理No付き+isTemporaryLoan=false → 業者持出しに含まない', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 10 });

        await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
            managementNo: '123456',
            type: 'SET',
            isTemporaryLoan: false,
        });

        const results = await getAirconStockWithVendorBreakdown();
        const p = results.find((r: any) => r.id === product.id);

        expect(p.vendorStock).toBe(0);
        expect(p.typeBreakdown.set).toBe(0);
    });

    it('✅ 管理No付き+isTemporaryLoan=true → 業者持出しにカウントされる', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 10 });

        await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
            managementNo: '789012',
            type: 'SET',
            isTemporaryLoan: true,
        });

        const results = await getAirconStockWithVendorBreakdown();
        const p = results.find((r: any) => r.id === product.id);

        expect(p.vendorStock).toBe(1);
        expect(p.typeBreakdown.set).toBe(1);
    });

    it('✅ 返却済みログは集計に含まれない', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 10 });

        await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
            isReturned: true,
        });

        const results = await getAirconStockWithVendorBreakdown();
        const p = results.find((r: any) => r.id === product.id);

        expect(p.vendorStock).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// 2. タイプ別在庫集計 (SET/INDOOR/OUTDOOR) とセット数計算
// ═══════════════════════════════════════════════════════════════
describe('タイプ別在庫集計 — セット数 + 端数表示', () => {
    it('✅ SET持出しのみ → indoor/outdoorは0', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 10 });

        await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
            type: 'SET',
        });

        const results = await getAirconStockWithVendorBreakdown();
        const p = results.find((r: any) => r.id === product.id);

        expect(p.typeBreakdown.set).toBe(1);
        expect(p.typeBreakdown.indoor).toBe(0);
        expect(p.typeBreakdown.outdoor).toBe(0);
    });

    it('✅ INDOOR持出し → indoor=1, 外機余りが発生', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 10 });

        await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
            type: 'INDOOR',
        });

        const results = await getAirconStockWithVendorBreakdown();
        const p = results.find((r: any) => r.id === product.id);

        expect(p.typeBreakdown.indoor).toBe(1);
        expect(p.typeBreakdown.outdoor).toBe(0);

        // 在庫表示: totalStock=11, 内機1台多い→外機1台余り
        // セット数 = totalStock - extraOutdoor = 11 - 0 = 11?
        // No: extraOutdoor = indoor > outdoor ? indoor - outdoor : 0 = 1
        // セット数 = 11 - 1 = 10
        const { indoor, outdoor } = p.typeBreakdown;
        const extraOutdoor = indoor > outdoor ? indoor - outdoor : 0;
        const setCount = p.totalStock - extraOutdoor;
        expect(extraOutdoor).toBe(1);
        expect(setCount).toBe(p.totalStock - 1);
    });

    it('✅ INDOOR+OUTDOOR同数 → 端数なし', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 10 });

        await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
            type: 'INDOOR',
        });
        await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
            type: 'OUTDOOR',
        });

        const results = await getAirconStockWithVendorBreakdown();
        const p = results.find((r: any) => r.id === product.id);

        const { indoor, outdoor } = p.typeBreakdown;
        const extraOutdoor = indoor > outdoor ? indoor - outdoor : 0;
        const extraIndoor = outdoor > indoor ? outdoor - indoor : 0;
        expect(extraOutdoor).toBe(0);
        expect(extraIndoor).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// 3. 引当変更 (updateAirconLogAssignment) + 一時貸出フラグ
// ═══════════════════════════════════════════════════════════════
describe('updateAirconLogAssignment — 引当変更+一時貸出', () => {
    it('✅ 管理No+顧客名+業者+一時貸出フラグを更新できる', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 5 });

        const log = await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
        });

        const result = await updateAirconLogAssignment(
            [log.id],
            'NEW-MGMT-001',
            'テスト顧客',
            'テスト業者',
            true // isTemporaryLoan
        );

        expect(result.success).toBe(true);

        // DB確認
        const updated = await prisma.airConditionerLog.findUnique({
            where: { id: log.id },
        });
        expect(updated?.managementNo).toBe('NEW-MGMT-001');
        expect(updated?.customerName).toBe('テスト顧客');
        expect(updated?.contractor).toBe('テスト業者');
        expect(updated?.isTemporaryLoan).toBe(true);
    });

    it('✅ 一時貸出をfalseに戻せる', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 5 });

        const log = await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
            isTemporaryLoan: true,
        });

        await updateAirconLogAssignment(
            [log.id],
            '999999',
            '通常顧客',
            '通常業者',
            false // isTemporaryLoan解除
        );

        const updated = await prisma.airConditionerLog.findUnique({
            where: { id: log.id },
        });
        expect(updated?.isTemporaryLoan).toBe(false);
    });

    it('✅ 複数ログを一括で更新できる', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 10 });

        const log1 = await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
        });
        const log2 = await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
        });

        const result = await updateAirconLogAssignment(
            [log1.id, log2.id],
            'BULK-001',
            '一括顧客',
            '一括業者',
            true
        );

        expect(result.success).toBe(true);

        const updated1 = await prisma.airConditionerLog.findUnique({ where: { id: log1.id } });
        const updated2 = await prisma.airConditionerLog.findUnique({ where: { id: log2.id } });

        expect(updated1?.managementNo).toBe('BULK-001');
        expect(updated1?.isTemporaryLoan).toBe(true);
        expect(updated2?.managementNo).toBe('BULK-001');
        expect(updated2?.isTemporaryLoan).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════
// 4. 戻し処理 (returnAircon) — 在庫復元の確認
// ═══════════════════════════════════════════════════════════════
describe('returnAircon — 戻し処理', () => {
    it('✅ 戻し処理で在庫が1台増加する', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 5 });

        const log = await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
        });

        const result = await returnAircon(log.id);
        expect(result.success).toBe(true);

        // 在庫が増加したか確認
        const updatedProduct = await prisma.airconProduct.findUnique({
            where: { id: product.id },
        });
        expect(updatedProduct?.stock).toBe(6); // 5 + 1

        // ログが返却済みか確認
        const updatedLog = await prisma.airConditionerLog.findUnique({
            where: { id: log.id },
        });
        expect(updatedLog?.isReturned).toBe(true);
        expect(updatedLog?.returnedAt).not.toBeNull();
    });

    it('✅ 既に返却済みのログは再度戻せない', async () => {
        const vendor = await createTestVendor();
        const product = await createTestAirconProduct({ stock: 5 });

        const log = await createTestLog({
            vendorId: vendor.id,
            productId: product.id,
            modelNumber: product.code,
            isReturned: true,
        });

        const result = await returnAircon(log.id);

        // 既に返却済みなのでエラーか在庫変動なし
        const updatedProduct = await prisma.airconProduct.findUnique({
            where: { id: product.id },
        });
        // 在庫は変わらない（5のまま）
        expect(updatedProduct?.stock).toBe(5);
    });
});

// ═══════════════════════════════════════════════════════════════
// 5. 業者別集計の正確性
// ═══════════════════════════════════════════════════════════════
describe('業者別集計 — vendorBreakdown', () => {
    it('✅ 一時貸出ログの業者ごとの集計が正しい', async () => {
        const vendor1 = await createTestVendor({ name: '業者A' });
        const vendor2 = await createTestVendor({ name: '業者B' });
        const product = await createTestAirconProduct({ stock: 10 });

        // 業者A: SET x2
        await createTestLog({ vendorId: vendor1.id, productId: product.id, modelNumber: product.code, type: 'SET' });
        await createTestLog({ vendorId: vendor1.id, productId: product.id, modelNumber: product.code, type: 'SET' });

        // 業者B: INDOOR x1 (一時貸出)
        await createTestLog({
            vendorId: vendor2.id,
            productId: product.id,
            modelNumber: product.code,
            type: 'INDOOR',
            managementNo: '654321',
            isTemporaryLoan: true,
        });

        const results = await getAirconStockWithVendorBreakdown();
        const p = results.find((r: any) => r.id === product.id);

        expect(p.vendorStock).toBe(3); // 2 + 1
        expect(p.vendorBreakdown.length).toBe(2);

        const v1 = p.vendorBreakdown.find((v: any) => v.name === '業者A');
        const v2 = p.vendorBreakdown.find((v: any) => v.name === '業者B');

        expect(v1?.count).toBe(2);
        expect(v1?.set).toBe(2);
        expect(v2?.count).toBe(1);
        expect(v2?.indoor).toBe(1);
    });
});
