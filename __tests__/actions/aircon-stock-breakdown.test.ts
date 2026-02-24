/**
 * エアコン在庫 持出し内訳テスト (aircon-stock-breakdown.test.ts)
 *
 * テスト対象:
 * - getAirconStockWithVendorBreakdown: SET/INDOOR/OUTDOOR別の持出し集計
 *   - 管理番号ありのログはtypeBreakdownから除外されること
 *   - INTERNALのログはtypeBreakdownに含まれること
 *   - SET/INDOOR/OUTDOORが正しくカウントされること
 *   - 業者別の内訳にもtype別カウントが含まれること
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createTestAirconProduct,
    createTestVendor,
    prisma,
} from '../setup/setup';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { getAirconStockWithVendorBreakdown } = await import('@/lib/aircon-actions');

describe('getAirconStockWithVendorBreakdown — 持出し内訳集計', () => {

    it('✅ 正常: 持出しなしの場合typeBreakdownは全て0', async () => {
        await createTestAirconProduct({ stock: 5 });

        const products = await getAirconStockWithVendorBreakdown();
        const product = products[0];

        expect(product.typeBreakdown).toEqual({ set: 0, indoor: 0, outdoor: 0, purchase: 0 });
        expect(product.vendorStock).toBe(0);
        expect(product.totalStock).toBe(5);
    });

    it('✅ 正常: 管理番号ありのログはtypeBreakdownから除外される', async () => {
        const vendor = await createTestVendor();
        const aircon = await createTestAirconProduct({ stock: 5 });

        // 管理番号ありのSETログ（物件紐づけ済み＝使用済み）
        await prisma.airConditionerLog.create({
            data: {
                managementNo: '123456',
                modelNumber: aircon.code,
                vendorId: vendor.id,
                airconProductId: aircon.id,
                type: 'SET',
            },
        });

        const products = await getAirconStockWithVendorBreakdown();
        const product = products.find(p => p.id === aircon.id)!;

        // 管理番号ありは内訳に含まれない
        expect(product.typeBreakdown).toEqual({ set: 0, indoor: 0, outdoor: 0, purchase: 0 });
        expect(product.vendorStock).toBe(0);
    });

    it('✅ 正常: INTERNALのログはtypeBreakdownに含まれる', async () => {
        const vendor = await createTestVendor();
        const aircon = await createTestAirconProduct({ stock: 5 });

        // INTERNAL（予備・自社在庫）のINDOORログ
        await prisma.airConditionerLog.create({
            data: {
                managementNo: 'INTERNAL',
                modelNumber: aircon.code,
                vendorId: vendor.id,
                airconProductId: aircon.id,
                type: 'INDOOR',
            },
        });

        const products = await getAirconStockWithVendorBreakdown();
        const product = products.find(p => p.id === aircon.id)!;

        expect(product.typeBreakdown).toEqual({ set: 0, indoor: 1, outdoor: 0, purchase: 0 });
        expect(product.vendorStock).toBe(1);
    });

    it('✅ 正常: SET/INDOOR/OUTDOORが正しくカウントされる', async () => {
        const vendor = await createTestVendor();
        const aircon = await createTestAirconProduct({ stock: 10 });

        // 管理番号なしのログを複数タイプで作成
        const types = ['SET', 'SET', 'INDOOR', 'OUTDOOR', 'OUTDOOR', 'OUTDOOR'];
        for (const type of types) {
            await prisma.airConditionerLog.create({
                data: {
                    managementNo: null,
                    modelNumber: aircon.code,
                    vendorId: vendor.id,
                    airconProductId: aircon.id,
                    type,
                },
            });
        }

        const products = await getAirconStockWithVendorBreakdown();
        const product = products.find(p => p.id === aircon.id)!;

        expect(product.typeBreakdown).toEqual({ set: 2, indoor: 1, outdoor: 3, purchase: 0 });
        expect(product.vendorStock).toBe(6);
    });

    it('✅ 正常: 業者別内訳にもtype別カウントが含まれる', async () => {
        const vendorA = await createTestVendor({ name: '業者A' });
        const vendorB = await createTestVendor({ name: '業者B' });
        const aircon = await createTestAirconProduct({ stock: 10 });

        // 業者A: SET×1, INDOOR×1
        await prisma.airConditionerLog.create({
            data: { managementNo: null, modelNumber: aircon.code, vendorId: vendorA.id, airconProductId: aircon.id, type: 'SET' },
        });
        await prisma.airConditionerLog.create({
            data: { managementNo: null, modelNumber: aircon.code, vendorId: vendorA.id, airconProductId: aircon.id, type: 'INDOOR' },
        });

        // 業者B: OUTDOOR×2
        await prisma.airConditionerLog.create({
            data: { managementNo: null, modelNumber: aircon.code, vendorId: vendorB.id, airconProductId: aircon.id, type: 'OUTDOOR' },
        });
        await prisma.airConditionerLog.create({
            data: { managementNo: null, modelNumber: aircon.code, vendorId: vendorB.id, airconProductId: aircon.id, type: 'OUTDOOR' },
        });

        const products = await getAirconStockWithVendorBreakdown();
        const product = products.find(p => p.id === aircon.id)!;

        // 業者A の内訳
        const breakdownA = product.vendorBreakdown.find(v => v.id === vendorA.id)!;
        expect(breakdownA.set).toBe(1);
        expect(breakdownA.indoor).toBe(1);
        expect(breakdownA.outdoor).toBe(0);
        expect(breakdownA.count).toBe(2);

        // 業者B の内訳
        const breakdownB = product.vendorBreakdown.find(v => v.id === vendorB.id)!;
        expect(breakdownB.set).toBe(0);
        expect(breakdownB.indoor).toBe(0);
        expect(breakdownB.outdoor).toBe(2);
        expect(breakdownB.count).toBe(2);
    });

    it('✅ 正常: 返却済み(isReturned=true)のログはtypeBreakdownに含まれない', async () => {
        const vendor = await createTestVendor();
        const aircon = await createTestAirconProduct({ stock: 5 });

        // 返却済みログ
        await prisma.airConditionerLog.create({
            data: {
                managementNo: null,
                modelNumber: aircon.code,
                vendorId: vendor.id,
                airconProductId: aircon.id,
                type: 'SET',
                isReturned: true,
                returnedAt: new Date(),
            },
        });

        // 未返却ログ
        await prisma.airConditionerLog.create({
            data: {
                managementNo: null,
                modelNumber: aircon.code,
                vendorId: vendor.id,
                airconProductId: aircon.id,
                type: 'INDOOR',
            },
        });

        const products = await getAirconStockWithVendorBreakdown();
        const product = products.find(p => p.id === aircon.id)!;

        // 返却済みSETは除外、未返却INDOORのみ
        expect(product.typeBreakdown).toEqual({ set: 0, indoor: 1, outdoor: 0, purchase: 0 });
        expect(product.vendorStock).toBe(1);
    });

    it('✅ 正常: 管理番号ありとINTERNALが混在する場合は正しくフィルタされる', async () => {
        const vendor = await createTestVendor();
        const aircon = await createTestAirconProduct({ stock: 10 });

        // 管理番号あり（除外対象）
        await prisma.airConditionerLog.create({
            data: { managementNo: '111111', modelNumber: aircon.code, vendorId: vendor.id, airconProductId: aircon.id, type: 'SET' },
        });
        await prisma.airConditionerLog.create({
            data: { managementNo: '222222', modelNumber: aircon.code, vendorId: vendor.id, airconProductId: aircon.id, type: 'SET' },
        });

        // 管理番号なし（含める）
        await prisma.airConditionerLog.create({
            data: { managementNo: null, modelNumber: aircon.code, vendorId: vendor.id, airconProductId: aircon.id, type: 'SET' },
        });

        // INTERNAL（含める）
        await prisma.airConditionerLog.create({
            data: { managementNo: 'INTERNAL', modelNumber: aircon.code, vendorId: vendor.id, airconProductId: aircon.id, type: 'INDOOR' },
        });

        const products = await getAirconStockWithVendorBreakdown();
        const product = products.find(p => p.id === aircon.id)!;

        // 管理番号ありの2件は除外、null+INTERNALの2件のみ
        expect(product.typeBreakdown).toEqual({ set: 1, indoor: 1, outdoor: 0, purchase: 0 });
        expect(product.vendorStock).toBe(2);
    });
});
