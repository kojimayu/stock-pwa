"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// エアコン商品一覧取得（発注管理用、シンプル版）
export async function getAirconProducts() {
    return prisma.airconProduct.findMany({
        orderBy: { code: "asc" },
    });
}

// エアコン商品一覧取得（業者保有在庫つき）
export async function getAirconStockWithVendorBreakdown() {
    const products = await prisma.airconProduct.findMany({
        orderBy: { code: "asc" },
        include: {
            _count: {
                select: { orderItems: true }
            },
            logs: {
                where: {
                    isReturned: false,
                    managementNo: null // 管理番号がないもの＝業者在庫
                },
                include: { vendor: true }
            }
        }
    });

    // 業者保有在庫の集計を行う
    return products.map(product => {
        const vendorStockMap = new Map<number, { id: number, name: string, count: number }>();
        let totalVendorStock = 0;

        product.logs.forEach(log => {
            if (!log.vendor) return;
            const vendorId = log.vendor.id;
            if (!vendorStockMap.has(vendorId)) {
                vendorStockMap.set(vendorId, { id: vendorId, name: log.vendor.name, count: 0 });
            }
            vendorStockMap.get(vendorId)!.count++;
            totalVendorStock++;
        });

        const vendorBreakdown = Array.from(vendorStockMap.values()).sort((a, b) => b.count - a.count);

        return {
            ...product,
            logs: undefined, // フロントエンドには渡さない
            vendorStock: totalVendorStock,
            totalStock: product.stock + totalVendorStock,
            vendorBreakdown
        };
    });
}

// エアコン商品在庫更新
export async function updateAirconStock(productId: number, adjustment: number) {
    const product = await prisma.airconProduct.findUnique({
        where: { id: productId }
    });

    if (!product) {
        return { success: false, message: "商品が見つかりません" };
    }

    const newStock = product.stock + adjustment;

    if (newStock < 0) {
        return { success: false, message: "在庫がマイナスになります" };
    }

    await prisma.airconProduct.update({
        where: { id: productId },
        data: { stock: newStock }
    });

    revalidatePath("/admin/aircon-inventory");
    return { success: true, newStock };
}

// エアコン商品サフィックス更新
export async function updateAirconProductSuffix(productId: number, suffix: string) {
    await prisma.airconProduct.update({
        where: { id: productId },
        data: { suffix: suffix.toUpperCase() }
    });
    revalidatePath("/admin/aircon-inventory");
    revalidatePath("/admin/aircon-orders");
    return { success: true };
}

// エアコン持出し時の在庫減算
export async function decrementAirconStock(productCode: string) {
    // 年度サフィックスを除いたコードで検索
    const baseCode = productCode.replace(/[A-Z]$/, ""); // 末尾アルファベット除去

    const product = await prisma.airconProduct.findFirst({
        where: { code: { startsWith: baseCode.substring(0, 8) } } // RAS-AJ22 等
    });

    if (product && product.stock > 0) {
        await prisma.airconProduct.update({
            where: { id: product.id },
            data: { stock: product.stock - 1 }
        });
        return { success: true, productId: product.id };
    }

    return { success: false, productId: null };
}

// エアコン戻し処理
export async function returnAircon(logId: number) {
    const log = await prisma.airConditionerLog.findUnique({
        where: { id: logId },
        include: { airconProduct: true }
    });

    if (!log) {
        return { success: false, message: "ログが見つかりません" };
    }

    if (log.isReturned) {
        return { success: false, message: "既に戻し済みです" };
    }

    // トランザクションで戻し処理
    await prisma.$transaction(async (tx) => {
        // ログを戻し済みに更新
        await tx.airConditionerLog.update({
            where: { id: logId },
            data: {
                isReturned: true,
                returnedAt: new Date()
            }
        });

        // 在庫を戻す（紐付けがあれば）
        if (log.airconProductId) {
            await tx.airconProduct.update({
                where: { id: log.airconProductId },
                data: { stock: { increment: 1 } }
            });
        }
    });

    revalidatePath("/admin/aircon-logs");
    revalidatePath("/admin/aircon-inventory");
    return { success: true };
}

// 年度サフィックス取得
export async function getAirconYearSuffix() {
    const setting = await prisma.systemSetting.findUnique({
        where: { key: "aircon_year_suffix" }
    });
    return setting?.value || "N";
}

// 年度サフィックス更新
export async function updateAirconYearSuffix(suffix: string) {
    await prisma.systemSetting.upsert({
        where: { key: "aircon_year_suffix" },
        update: { value: suffix },
        create: { key: "aircon_year_suffix", value: suffix }
    });
    revalidatePath("/admin/aircon-inventory");
    return { success: true };
}

// エアコン発注一覧取得
export async function getAirconOrders() {
    return prisma.airconOrder.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            deliveryLocation: true,
            items: {
                include: { product: true }
            }
        }
    });
}

// 発注番号の自動採番
async function generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `AC-${year}-`;
    const latest = await prisma.airconOrder.findFirst({
        where: { orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: "desc" }
    });
    const seq = latest?.orderNumber
        ? parseInt(latest.orderNumber.replace(prefix, ""), 10) + 1
        : 1;
    return `${prefix}${String(seq).padStart(3, "0")}`;
}

// エアコン発注作成（拡張版: 拠点・備考対応）
export async function createAirconOrder(
    items: { productId: number; quantity: number }[],
    deliveryLocationId?: number,
    note?: string
) {
    const orderNumber = await generateOrderNumber();
    const order = await prisma.airconOrder.create({
        data: {
            orderNumber,
            status: "DRAFT",
            note: note || null,
            deliveryLocationId: deliveryLocationId || null,
            items: {
                create: items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity
                }))
            }
        },
        include: {
            deliveryLocation: true,
            items: { include: { product: true } }
        }
    });

    revalidatePath("/admin/aircon-orders");
    return { success: true, order };
}

// 発注ステータス更新
export async function updateAirconOrderStatus(orderId: number, status: string) {
    const data: Record<string, unknown> = { status };
    if (status === "ORDERED") {
        data.orderedAt = new Date();
    }
    await prisma.airconOrder.update({
        where: { id: orderId },
        data
    });
    revalidatePath("/admin/aircon-orders");
    return { success: true };
}

// 発注入荷処理
export async function receiveAirconOrderItem(itemId: number, quantity: number) {
    const item = await prisma.airconOrderItem.findUnique({
        where: { id: itemId },
        include: { product: true, order: true }
    });

    if (!item) {
        return { success: false, message: "発注明細が見つかりません" };
    }

    await prisma.$transaction(async (tx) => {
        // 入荷数更新
        await tx.airconOrderItem.update({
            where: { id: itemId },
            data: { receivedQuantity: { increment: quantity } }
        });

        // 在庫追加
        await tx.airconProduct.update({
            where: { id: item.productId },
            data: { stock: { increment: quantity } }
        });

        // 発注全体のステータスを確認・更新
        const updatedItems = await tx.airconOrderItem.findMany({
            where: { orderId: item.orderId }
        });

        const allReceived = updatedItems.every(i =>
            (i.id === itemId ? i.receivedQuantity + quantity : i.receivedQuantity) >= i.quantity
        );
        const anyReceived = updatedItems.some(i =>
            (i.id === itemId ? i.receivedQuantity + quantity : i.receivedQuantity) > 0
        );

        if (allReceived) {
            await tx.airconOrder.update({
                where: { id: item.orderId },
                data: { status: "RECEIVED" }
            });
        } else if (anyReceived) {
            await tx.airconOrder.update({
                where: { id: item.orderId },
                data: { status: "PARTIAL" }
            });
        }
    });

    revalidatePath("/admin/aircon-orders");
    revalidatePath("/admin/aircon-inventory");
    return { success: true };
}

// 発注メール送信記録
export async function markOrderEmailSent(orderId: number, orderedBy: string) {
    await prisma.airconOrder.update({
        where: { id: orderId },
        data: {
            status: "ORDERED",
            orderedAt: new Date(),
            orderedBy,
            emailSentAt: new Date()
        }
    });
    revalidatePath("/admin/aircon-orders");
    return { success: true };
}

// ===============================
// 拠点管理
// ===============================

// 拠点一覧取得
export async function getDeliveryLocations() {
    return prisma.deliveryLocation.findMany({
        orderBy: { id: "asc" }
    });
}

// 拠点作成
export async function createDeliveryLocation(name: string, address?: string) {
    const loc = await prisma.deliveryLocation.create({
        data: { name, address: address || null }
    });
    revalidatePath("/admin/aircon-orders");
    return { success: true, location: loc };
}

// 拠点更新
export async function updateDeliveryLocation(id: number, data: { name?: string; address?: string; isActive?: boolean }) {
    await prisma.deliveryLocation.update({
        where: { id },
        data
    });
    revalidatePath("/admin/aircon-orders");
    return { success: true };
}

// 拠点削除
export async function deleteDeliveryLocation(id: number) {
    // 使用中チェック
    const usedCount = await prisma.airconOrder.count({
        where: { deliveryLocationId: id }
    });
    if (usedCount > 0) {
        return { success: false, message: `${usedCount}件の発注で使用中のため削除できません。無効化してください。` };
    }
    await prisma.deliveryLocation.delete({ where: { id } });
    revalidatePath("/admin/aircon-orders");
    return { success: true };
}

// ===============================
// メール設定（SystemSetting）
// ===============================

// メール設定取得
export async function getOrderEmailSettings() {
    const settings = await prisma.systemSetting.findMany({
        where: {
            key: { in: ["aircon_order_to", "aircon_order_cc", "aircon_order_from_company"] }
        }
    });
    const result: Record<string, string> = {};
    for (const s of settings) {
        result[s.key] = s.value;
    }
    return result;
}

// メール設定更新
export async function updateOrderEmailSetting(key: string, value: string) {
    await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
    });
    return { success: true };
}

// ベンダーごとのエアコン持出し履歴取得
export async function getVendorAirconHistory(vendorId: number) {
    return prisma.airConditionerLog.findMany({
        where: { vendorId },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
            airconProduct: true
        }
    });
}

// エアコン持出し履歴の修正（管理情報のみ）
export async function updateAirconLogInfo(logId: number, data: { managementNo?: string; customerName?: string; contractor?: string }) {
    await prisma.airConditionerLog.update({
        where: { id: logId },
        data: {
            managementNo: data.managementNo,
            customerName: data.customerName,
            contractor: data.contractor
        }
    });
    return { success: true };
}
