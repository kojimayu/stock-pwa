/**
 * エアコン発注システムテスト (aircon-order.test.ts)
 *
 * テスト対象:
 * - createAirconOrder: 発注作成（拠点・備考・自動採番）
 * - getAirconOrders: 発注一覧取得
 * - updateAirconOrderStatus: ステータス更新
 * - receiveAirconOrderItem: 入荷処理（在庫加算・ステータス自動遷移）
 * - getDeliveryLocations: 拠点一覧取得
 * - createDeliveryLocation: 拠点作成
 * - updateDeliveryLocation: 拠点更新
 * - deleteDeliveryLocation: 拠点削除（使用中チェック）
 * - getOrderEmailSettings: メール設定取得
 * - updateOrderEmailSetting: メール設定更新
 * - markOrderEmailSent: メール送信記録
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createTestAirconProduct,
    createTestDeliveryLocation,
    prisma,
} from '../setup/setup';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const {
    createAirconOrder,
    getAirconOrders,
    updateAirconOrderStatus,
    receiveAirconOrderItem,
    markOrderEmailSent,
    getDeliveryLocations,
    createDeliveryLocation,
    updateDeliveryLocation,
    deleteDeliveryLocation,
    getOrderEmailSettings,
    updateOrderEmailSetting,
} = await import('@/lib/aircon-actions');

// ===============================
// 発注作成・取得
// ===============================

describe('createAirconOrder — 発注作成', () => {
    it('✅ 正常: 発注を作成できる（基本）', async () => {
        const product = await createTestAirconProduct({ stock: 5 });

        const result = await createAirconOrder([
            { productId: product.id, quantity: 2 }
        ]);

        expect(result.success).toBe(true);
        expect(result.order).toBeDefined();
        expect(result.order.status).toBe('DRAFT');
        expect(result.order.items.length).toBe(1);
        expect(result.order.items[0].quantity).toBe(2);
    });

    it('✅ 正常: 発注番号が自動採番される', async () => {
        const product = await createTestAirconProduct();
        const result = await createAirconOrder([
            { productId: product.id, quantity: 1 }
        ]);

        expect(result.order.orderNumber).toMatch(/^AC-\d{4}-\d{3}$/);
    });

    it('✅ 正常: 拠点と備考を指定して作成できる', async () => {
        const product = await createTestAirconProduct();
        const location = await createTestDeliveryLocation({ name: 'ZION倉庫' });

        const result = await createAirconOrder(
            [{ productId: product.id, quantity: 3 }],
            location.id,
            '急ぎの手配'
        );

        expect(result.order.deliveryLocationId).toBe(location.id);
        expect(result.order.note).toBe('急ぎの手配');
    });

    it('✅ 正常: 複数商品を一度に発注できる', async () => {
        const p1 = await createTestAirconProduct({ stock: 10 });
        const p2 = await createTestAirconProduct({ stock: 5 });

        const result = await createAirconOrder([
            { productId: p1.id, quantity: 2 },
            { productId: p2.id, quantity: 4 },
        ]);

        expect(result.order.items.length).toBe(2);
    });
});

describe('getAirconOrders — 発注一覧取得', () => {
    it('✅ 正常: 発注一覧を取得できる', async () => {
        const product = await createTestAirconProduct();
        await createAirconOrder([{ productId: product.id, quantity: 1 }]);

        const orders = await getAirconOrders();
        expect(orders.length).toBeGreaterThanOrEqual(1);
    });

    it('✅ 正常: deliveryLocationが含まれる', async () => {
        const product = await createTestAirconProduct();
        const location = await createTestDeliveryLocation();
        await createAirconOrder([{ productId: product.id, quantity: 1 }], location.id);

        const orders = await getAirconOrders();
        const order = orders.find(o => o.deliveryLocationId === location.id);
        expect(order?.deliveryLocation).toBeDefined();
        expect(order?.deliveryLocation?.name).toBe(location.name);
    });
});

// ===============================
// ステータス更新・入荷処理
// ===============================

describe('updateAirconOrderStatus — ステータス更新', () => {
    it('✅ 正常: ステータスを更新できる', async () => {
        const product = await createTestAirconProduct();
        const { order } = await createAirconOrder([{ productId: product.id, quantity: 1 }]);

        await updateAirconOrderStatus(order.id, 'ORDERED');

        const updated = await prisma.airconOrder.findUnique({ where: { id: order.id } });
        expect(updated?.status).toBe('ORDERED');
    });

    it('✅ 正常: ORDEREDに変更時にorderedAtが設定される', async () => {
        const product = await createTestAirconProduct();
        const { order } = await createAirconOrder([{ productId: product.id, quantity: 1 }]);

        await updateAirconOrderStatus(order.id, 'ORDERED');

        const updated = await prisma.airconOrder.findUnique({ where: { id: order.id } });
        expect(updated?.orderedAt).toBeDefined();
    });
});

describe('receiveAirconOrderItem — 入荷処理', () => {
    it('✅ 正常: 入荷で在庫が増加する', async () => {
        const product = await createTestAirconProduct({ stock: 0 });
        const { order } = await createAirconOrder([{ productId: product.id, quantity: 3 }]);
        await updateAirconOrderStatus(order.id, 'ORDERED');

        const item = order.items[0];
        await receiveAirconOrderItem(item.id, 2);

        const updated = await prisma.airconProduct.findUnique({ where: { id: product.id } });
        expect(updated?.stock).toBe(2);
    });

    it('✅ 正常: 全数入荷でステータスがRECEIVEDになる', async () => {
        const product = await createTestAirconProduct({ stock: 0 });
        const { order } = await createAirconOrder([{ productId: product.id, quantity: 5 }]);

        const item = order.items[0];
        await receiveAirconOrderItem(item.id, 5);

        const updated = await prisma.airconOrder.findUnique({ where: { id: order.id } });
        expect(updated?.status).toBe('RECEIVED');
    });

    it('✅ 正常: 一部入荷でステータスがPARTIALになる', async () => {
        const product = await createTestAirconProduct({ stock: 0 });
        const { order } = await createAirconOrder([{ productId: product.id, quantity: 5 }]);

        const item = order.items[0];
        await receiveAirconOrderItem(item.id, 2);

        const updated = await prisma.airconOrder.findUnique({ where: { id: order.id } });
        expect(updated?.status).toBe('PARTIAL');
    });
});

describe('markOrderEmailSent — メール送信記録', () => {
    it('✅ 正常: メール送信を記録できる', async () => {
        const product = await createTestAirconProduct();
        const { order } = await createAirconOrder([{ productId: product.id, quantity: 1 }]);

        await markOrderEmailSent(order.id, 'admin@example.com');

        const updated = await prisma.airconOrder.findUnique({ where: { id: order.id } });
        expect(updated?.status).toBe('ORDERED');
        expect(updated?.orderedBy).toBe('admin@example.com');
        expect(updated?.emailSentAt).toBeDefined();
    });
});

// ===============================
// 拠点管理
// ===============================

describe('getDeliveryLocations — 拠点一覧', () => {
    it('✅ 正常: 拠点一覧を取得できる', async () => {
        await createTestDeliveryLocation({ name: '本社' });
        await createTestDeliveryLocation({ name: 'ZION' });

        const locations = await getDeliveryLocations();
        expect(locations.length).toBeGreaterThanOrEqual(2);
    });
});

describe('createDeliveryLocation — 拠点作成', () => {
    it('✅ 正常: 拠点を作成できる', async () => {
        const result = await createDeliveryLocation('テスト倉庫', '大阪市中央区');

        expect(result.success).toBe(true);
        expect(result.location.name).toBe('テスト倉庫');
        expect(result.location.address).toBe('大阪市中央区');
    });
});

describe('updateDeliveryLocation — 拠点更新', () => {
    it('✅ 正常: 拠点を無効化できる', async () => {
        const loc = await createTestDeliveryLocation();

        await updateDeliveryLocation(loc.id, { isActive: false });

        const updated = await prisma.deliveryLocation.findUnique({ where: { id: loc.id } });
        expect(updated?.isActive).toBe(false);
    });
});

describe('deleteDeliveryLocation — 拠点削除', () => {
    it('✅ 正常: 未使用の拠点を削除できる', async () => {
        const loc = await createTestDeliveryLocation();
        const result = await deleteDeliveryLocation(loc.id);

        expect(result.success).toBe(true);
    });

    it('❌ エラー: 発注で使用中の拠点は削除できない', async () => {
        const product = await createTestAirconProduct();
        const loc = await createTestDeliveryLocation();
        await createAirconOrder([{ productId: product.id, quantity: 1 }], loc.id);

        const result = await deleteDeliveryLocation(loc.id);

        expect(result.success).toBe(false);
        expect(result.message).toContain('使用中');
    });
});

// ===============================
// メール設定
// ===============================

describe('getOrderEmailSettings / updateOrderEmailSetting — メール設定', () => {
    it('✅ 正常: メール設定を保存・取得できる', async () => {
        await updateOrderEmailSetting('aircon_order_to', JSON.stringify({
            name: 'テスト太郎',
            email: 'test@example.com'
        }));

        const settings = await getOrderEmailSettings();
        expect(settings['aircon_order_to']).toBeDefined();
        const parsed = JSON.parse(settings['aircon_order_to']);
        expect(parsed.name).toBe('テスト太郎');
        expect(parsed.email).toBe('test@example.com');
    });

    it('✅ 正常: CC設定を配列で保存できる', async () => {
        const ccList = [
            { name: 'CC1', company: 'Corp', email: 'cc1@test.com' },
            { name: 'CC2', company: 'Corp', email: 'cc2@test.com' },
        ];
        await updateOrderEmailSetting('aircon_order_cc', JSON.stringify(ccList));

        const settings = await getOrderEmailSettings();
        const parsed = JSON.parse(settings['aircon_order_cc']);
        expect(parsed.length).toBe(2);
        expect(parsed[0].email).toBe('cc1@test.com');
    });
});
