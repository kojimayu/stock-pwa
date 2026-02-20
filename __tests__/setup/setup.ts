/**
 * setup.ts: 各テストファイルの実行前に毎回実行されるセットアップ
 * - テスト間でDBを初期化してテストを独立させる
 */
import { PrismaClient } from '@prisma/client';
import { beforeEach, afterAll } from 'vitest';

const prisma = new PrismaClient();

/**
 * 各テスト前にDBをクリーンにする（依存関係の逆順で削除）
 */
beforeEach(async () => {
    // 依存関係の深いテーブルから順に削除
    await prisma.airConditionerLog.deleteMany();
    await prisma.airconOrderItem.deleteMany();
    await prisma.airconOrder.deleteMany();
    await prisma.deliveryLocation.deleteMany();
    await prisma.operationLog.deleteMany();
    await prisma.inventoryLog.deleteMany();
    await prisma.inventoryCountItem.deleteMany();
    await prisma.inventoryCount.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.vendorUser.deleteMany();
    await prisma.vendor.deleteMany();
    await prisma.product.deleteMany();
    await prisma.airconProduct.deleteMany();
    await prisma.adminUser.deleteMany();
});

afterAll(async () => {
    await prisma.$disconnect();
});

/**
 * テスト用ファクトリ関数 — 共通のテストデータを生成する
 */

/** テスト用業者を作成 */
export async function createTestVendor(overrides = {}) {
    return prisma.vendor.create({
        data: {
            name: 'テスト施工業者',
            isActive: true,
            accessCompanyName: 'test-company',
            ...overrides,
        },
    });
}

/** テスト用担当者を作成 */
export async function createTestVendorUser(vendorId: number, overrides = {}) {
    return prisma.vendorUser.create({
        data: {
            name: 'テスト太郎',
            pinCode: '5678',
            pinChanged: true,
            vendorId,
            ...overrides,
        },
    });
}

/** テスト用商品を作成 */
export async function createTestProduct(overrides = {}) {
    const code = `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return prisma.product.create({
        data: {
            code,
            name: 'テスト部材',
            category: 'テストカテゴリ',
            priceA: 1000,
            priceB: 900,
            priceC: 800,
            cost: 500,
            stock: 10,
            minStock: 2,
            ...overrides,
        },
    });
}

/** テスト用エアコン商品を作成 */
export async function createTestAirconProduct(overrides = {}) {
    const code = `RAS-TEST-${Date.now()}`;
    return prisma.airconProduct.create({
        data: {
            code,
            name: 'テストエアコン 2.2kW',
            capacity: '2.2kW',
            suffix: 'N',
            stock: 3,
            minStock: 1,
            ...overrides,
        },
    });
}

/** テスト用納品先拠点を作成 */
export async function createTestDeliveryLocation(overrides = {}) {
    return prisma.deliveryLocation.create({
        data: {
            name: `テスト拠点-${Date.now()}`,
            address: 'テスト住所',
            isActive: true,
            ...overrides,
        },
    });
}

export { prisma };
