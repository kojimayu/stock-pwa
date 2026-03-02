"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logOperation } from "@/lib/actions";

/**
 * エアコン在庫が変動した際に、紐づく材料商品(Product)の在庫を同期する
 * @param airconProductId 変動したエアコン商品のID（省略時は全エアコン商品を同期）
 */
export async function syncAirconToMaterialStock(airconProductId?: number) {
    const condition = airconProductId
        ? { airconProductId }
        : { airconProductId: { not: null } };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkedProducts = await prisma.product.findMany({
        where: condition as any,
        select: { id: true, airconProductId: true, stock: true },
    });

    for (const lp of linkedProducts) {
        if (!lp.airconProductId) continue;
        const aircon = await prisma.airconProduct.findUnique({
            where: { id: lp.airconProductId },
            select: { stock: true },
        });
        if (aircon && aircon.stock !== lp.stock) {
            await prisma.product.update({
                where: { id: lp.id },
                data: { stock: aircon.stock },
            });
        }
    }
}

// エアコン商品一覧取得（発注管理用、シンプル版）
export async function getAirconProducts() {
    return prisma.airconProduct.findMany({
        orderBy: { code: "asc" },
    });
}

// エアコン商品の単価を更新（発注単価 + 販売単価A/B/C）
export async function updateAirconProductPrice(
    productId: number,
    prices: { orderPrice?: number; priceA?: number; priceB?: number; priceC?: number }
) {
    const product = await prisma.airconProduct.findUnique({ where: { id: productId } });
    await prisma.airconProduct.update({
        where: { id: productId },
        data: {
            ...(prices.orderPrice !== undefined && { orderPrice: prices.orderPrice }),
            ...(prices.priceA !== undefined && { priceA: prices.priceA }),
            ...(prices.priceB !== undefined && { priceB: prices.priceB }),
            ...(prices.priceC !== undefined && { priceC: prices.priceC }),
        },
    });
    revalidatePath("/admin/aircon-orders/settings");
    revalidatePath("/admin/aircon-inventory");
    logOperation("AIRCON_PRICE_UPDATE", `${product?.code || productId}`, `単価更新: ${JSON.stringify(prices)}`);
    return { success: true };
}

// エアコン商品の最低在庫数を更新
export async function updateAirconMinStock(
    productId: number,
    minStock: number
) {
    const product = await prisma.airconProduct.findUnique({ where: { id: productId } });
    const oldMin = product?.minStock ?? 0;
    await prisma.airconProduct.update({
        where: { id: productId },
        data: { minStock: Math.max(0, minStock) },
    });
    revalidatePath("/admin/aircon-orders/settings");
    revalidatePath("/admin/aircon-inventory");
    revalidatePath("/admin");
    logOperation("AIRCON_MIN_STOCK_UPDATE", `${product?.code || productId}`, `最低在庫: ${oldMin} → ${minStock}`);
    return { success: true };
}

// 下書き発注を削除
export async function deleteAirconOrder(orderId: number) {
    const order = await prisma.airconOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "DRAFT") {
        return { success: false, message: "下書き状態の発注のみ削除可能です" };
    }
    // 関連アイテムを先に削除
    await prisma.airconOrderItem.deleteMany({ where: { orderId } });
    await prisma.airconOrder.delete({ where: { id: orderId } });
    revalidatePath("/admin/aircon-orders");
    logOperation("AIRCON_ORDER_DELETE", `発注 #${order.orderNumber || orderId}`, `下書き発注を削除`);
    return { success: true };
}

// エアコン発注の納期回答日を更新
export async function updateAirconOrderDeliveryDate(
    orderId: number,
    expectedDeliveryDate: string | null
) {
    await prisma.airconOrder.update({
        where: { id: orderId },
        data: {
            expectedDeliveryDate: expectedDeliveryDate
                ? new Date(expectedDeliveryDate)
                : null,
        },
    });
    revalidatePath("/admin/aircon-orders");
    revalidatePath("/admin");
    logOperation("AIRCON_ORDER_DELIVERY_DATE", `発注 #${orderId}`, `納期回答: ${expectedDeliveryDate || '未設定'}`);
    return { success: true };
}

// エアコン商品一覧取得（業者保有在庫つき・SET/INDOOR/OUTDOOR別集計）
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
                },
                include: { vendor: true }
            }
        }
    });

    // 物件未紐づけ（管理番号なし）の持出しを集計する
    // 管理番号ありは使用済み（工事完了）として在庫から減算済みのため除外
    return products.map(product => {
        const vendorStockMap = new Map<number, { id: number, name: string, count: number, set: number, indoor: number, outdoor: number, purchase: number }>();
        let totalVendorStock = 0;
        // 全ログのタイプ別集計（管理No有無問わず、未返却の全持出し）
        const typeBreakdown = { set: 0, indoor: 0, outdoor: 0, purchase: 0 };

        product.logs.forEach(log => {
            const logType = (log.type || 'SET') as 'SET' | 'INDOOR' | 'OUTDOOR' | 'PURCHASE';

            // 管理No付き = 物件に紐づけ済み = 業者持出しにはカウントしない
            // ただし isTemporaryLoan=true の場合は一時貸出なので業者持出しにカウント
            if (log.managementNo && log.managementNo !== 'INTERNAL' && !log.isTemporaryLoan) return;

            // PURCHASE（買取）はタイプ集計のみ、業者持出しにはカウントしない（返却しないため）
            if (logType === 'PURCHASE') {
                typeBreakdown.purchase++;
                return;
            }

            if (logType === 'SET') typeBreakdown.set++;
            else if (logType === 'INDOOR') typeBreakdown.indoor++;
            else if (logType === 'OUTDOOR') typeBreakdown.outdoor++;

            // 業者別集計
            if (log.vendor) {
                const vendorId = log.vendor.id;
                if (!vendorStockMap.has(vendorId)) {
                    vendorStockMap.set(vendorId, { id: vendorId, name: log.vendor.name, count: 0, set: 0, indoor: 0, outdoor: 0, purchase: 0 });
                }
                const entry = vendorStockMap.get(vendorId)!;
                entry.count++;
                if (logType === 'SET') entry.set++;
                else if (logType === 'INDOOR') entry.indoor++;
                else if (logType === 'OUTDOOR') entry.outdoor++;
                totalVendorStock++;
            }
        });

        const vendorBreakdown = Array.from(vendorStockMap.values()).sort((a, b) => b.count - a.count);

        return {
            ...product,
            logs: undefined, // フロントエンドには渡さない
            vendorStock: totalVendorStock,
            totalStock: product.stock + totalVendorStock,
            vendorBreakdown,
            typeBreakdown, // SET/INDOOR/OUTDOOR別の全持出し数
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
    logOperation("AIRCON_STOCK_ADJUST", `${product.code}`, `在庫調整: ${product.stock} → ${newStock} (${adjustment > 0 ? '+' : ''}${adjustment})`);
    return { success: true, newStock };
}

// エアコン商品サフィックス更新
export async function updateAirconProductSuffix(productId: number, suffix: string) {
    const product = await prisma.airconProduct.findUnique({ where: { id: productId } });
    const oldSuffix = product?.suffix || "(なし)";
    await prisma.airconProduct.update({
        where: { id: productId },
        data: { suffix: suffix.toUpperCase() }
    });
    revalidatePath("/admin/aircon-inventory");
    revalidatePath("/admin/aircon-orders");
    revalidatePath("/admin/aircon-orders/settings");
    logOperation("AIRCON_SUFFIX_UPDATE", `${product?.code || productId}`, `サフィックス: ${oldSuffix} → ${suffix.toUpperCase()}`);
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
        logOperation("AIRCON_STOCK_DECREMENT", `${product.code}`, `持出しにより在庫減算: ${product.stock} → ${product.stock - 1}`);
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
    logOperation("AIRCON_RETURN", `ログ #${logId}`, `${log.airconProduct?.code || log.modelNumber} を返却 (在庫+1)`);
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
    logOperation("AIRCON_YEAR_SUFFIX_UPDATE", `年度サフィックス`, `${suffix}に変更`);
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

// 発注番号の自動採番（日付+連番: 20260225-001）
async function generateOrderNumber(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const prefix = `${y}${m}${d}-`;
    const latest = await prisma.airconOrder.findFirst({
        where: { orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: "desc" }
    });
    const seq = latest?.orderNumber
        ? parseInt(latest.orderNumber.split("-")[1], 10) + 1
        : 1;
    return `${prefix}${String(seq).padStart(3, "0")}`;
}

// エアコン発注作成（拡張版: 拠点・備考・カスタム納品先対応）
export async function createAirconOrder(
    items: { productId: number; quantity: number }[],
    deliveryLocationId?: number,
    note?: string,
    customDeliveryName?: string
) {
    const orderNumber = await generateOrderNumber();
    const order = await prisma.airconOrder.create({
        data: {
            orderNumber,
            status: "DRAFT",
            note: note || null,
            deliveryLocationId: deliveryLocationId || null,
            customDeliveryName: customDeliveryName || null,
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
    const itemSummary = items.map(i => `ProductID:${i.productId} x${i.quantity}`).join(', ');
    logOperation("AIRCON_ORDER_CREATE", `発注 #${orderNumber}`, `発注作成: ${itemSummary}${note ? ` メモ:${note}` : ''}`);
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
    logOperation("AIRCON_ORDER_STATUS", `発注 #${orderId}`, `ステータス変更: ${status}`);
    return { success: true };
}

// 発注入荷処理
export async function receiveAirconOrderItem(itemId: number, quantity: number) {
    const item = await prisma.airconOrderItem.findUnique({
        where: { id: itemId },
        include: {
            product: true,
            order: {
                include: { deliveryLocation: true }
            }
        }
    });

    if (!item) {
        return { success: false, message: "発注明細が見つかりません" };
    }

    const isMainWarehouse = item.order.deliveryLocation?.isMainWarehouse ?? false;

    await prisma.$transaction(async (tx) => {
        // 入荷数更新
        await tx.airconOrderItem.update({
            where: { id: itemId },
            data: { receivedQuantity: { increment: quantity } }
        });

        // 在庫追加（主倉庫の場合のみ）
        if (isMainWarehouse) {
            await tx.airconProduct.update({
                where: { id: item.productId },
                data: { stock: { increment: quantity } }
            });
        }

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

    // 材料在庫を同期（主倉庫の場合のみ）
    if (isMainWarehouse) {
        await syncAirconToMaterialStock(item.productId);
    }

    revalidatePath("/admin/aircon-orders");
    revalidatePath("/admin/aircon-inventory");
    logOperation("AIRCON_ORDER_RECEIVE", `発注 #${item.orderId}`, `入荷: ${item.product.code} x${quantity}${isMainWarehouse ? ' (主倉庫→在庫加算)' : ' (拠点直送)'}`);
    return { success: true, isMainWarehouse };
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
    logOperation("AIRCON_ORDER_EMAIL_SENT", `発注 #${orderId}`, `発注メール送信 (発注者: ${orderedBy})`);
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
    logOperation("DELIVERY_LOCATION_CREATE", `拠点: ${name}`, `新規作成${address ? ` 住所:${address}` : ''}`);
    return { success: true, location: loc };
}

// 拠点更新
export async function updateDeliveryLocation(id: number, data: { name?: string; address?: string; isActive?: boolean }) {
    await prisma.deliveryLocation.update({
        where: { id },
        data
    });
    revalidatePath("/admin/aircon-orders");
    logOperation("DELIVERY_LOCATION_UPDATE", `拠点 #${id}`, `更新: ${JSON.stringify(data)}`);
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
    logOperation("DELIVERY_LOCATION_DELETE", `拠点 #${id}`, `削除`);
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
    logOperation("EMAIL_SETTING_UPDATE", `メール設定: ${key}`, `値を更新`);
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
    logOperation("AIRCON_LOG_UPDATE", `ログ #${logId}`, `管理情報更新: ${JSON.stringify(data)}`);
    return { success: true };
}

// 管理番号の既存持出しログを検索（重複チェック用・注意喚起のみ）
export async function checkManagementNoDuplicates(managementNo: string) {
    if (!managementNo || managementNo === "INTERNAL") {
        return { hasDuplicates: false, logs: [] };
    }

    const existingLogs = await prisma.airConditionerLog.findMany({
        where: {
            managementNo,
            isReturned: false,
        },
        include: {
            vendor: { select: { name: true } },
            airconProduct: { select: { code: true, capacity: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    if (existingLogs.length === 0) {
        return { hasDuplicates: false, logs: [] };
    }

    return {
        hasDuplicates: true,
        logs: existingLogs.map(log => ({
            id: log.id,
            vendorName: log.vendor?.name || "不明",
            productCode: log.airconProduct?.code || log.modelNumber,
            capacity: log.airconProduct?.capacity || "",
            date: log.createdAt.toISOString(),
        })),
    };
}

// ===============================
// エアコン棚卸
// ===============================

// 棚卸セッション開始
export async function createAirconInventory(note?: string) {
    // 進行中の棚卸がないか確認
    const existing = await prisma.airconInventoryCount.findFirst({
        where: { status: "IN_PROGRESS" },
    });
    if (existing) {
        return { success: false, message: "進行中の棚卸があります。先に完了または中止してください。" };
    }

    // 全エアコン商品の現在在庫をスナップショット
    const products = await prisma.airconProduct.findMany({ orderBy: { code: "asc" } });

    const inventory = await prisma.airconInventoryCount.create({
        data: {
            status: "IN_PROGRESS",
            note,
            items: {
                create: products.map((p) => ({
                    productId: p.id,
                    expectedStock: p.stock,
                    actualStock: p.stock, // デフォルトは現在在庫（ユーザーが修正）
                    adjustment: 0,
                })),
            },
        },
        include: {
            items: {
                include: { product: true },
                orderBy: { product: { code: "asc" } },
            },
        },
    });

    revalidatePath("/admin/aircon-inventory");
    logOperation("AIRCON_INVENTORY_START", `棚卸 #${inventory.id}`, `エアコン棚卸開始${note ? ` メモ:${note}` : ''}`);
    return { success: true, inventory };
}

// 棚卸アイテムの実数更新
export async function updateAirconInventoryItem(itemId: number, actualStock: number, reason?: string | null) {
    const item = await prisma.airconInventoryCountItem.findUnique({
        where: { id: itemId },
        include: { inventory: true },
    });
    if (!item) {
        return { success: false, message: "アイテムが見つかりません" };
    }
    if (item.inventory.status !== "IN_PROGRESS") {
        return { success: false, message: "この棚卸は既に完了または中止されています" };
    }

    const adjustment = actualStock - item.expectedStock;
    await prisma.airconInventoryCountItem.update({
        where: { id: itemId },
        data: {
            actualStock,
            adjustment,
            reason: adjustment !== 0 ? (reason ?? null) : null,
        },
    });

    revalidatePath("/admin/aircon-inventory");
    return { success: true };
}

// エアコン棚卸アイテムの確認（OKボタン）
export async function checkAirconInventoryItem(itemId: number, checkedBy: string) {
    const item = await prisma.airconInventoryCountItem.findUnique({
        where: { id: itemId },
        include: { inventory: true }
    });
    if (!item) throw new Error("Item not found");
    if (item.inventory.status !== 'IN_PROGRESS') {
        throw new Error("棚卸は既に完了または中止されています");
    }

    await prisma.airconInventoryCountItem.update({
        where: { id: itemId },
        data: {
            checkedBy,
            checkedAt: new Date(),
        }
    });
}

// エアコン棚卸アイテムの確認取消
export async function uncheckAirconInventoryItem(itemId: number) {
    const item = await prisma.airconInventoryCountItem.findUnique({
        where: { id: itemId },
        include: { inventory: true }
    });
    if (!item) throw new Error("Item not found");
    if (item.inventory.status !== 'IN_PROGRESS') {
        throw new Error("棚卸は既に完了または中止されています");
    }

    await prisma.airconInventoryCountItem.update({
        where: { id: itemId },
        data: {
            checkedBy: null,
            checkedAt: null,
        }
    });
}

export async function completeAirconInventory(id: number, confirmedBy: string) {
    const inventory = await prisma.airconInventoryCount.findUnique({
        where: { id },
        include: { items: true },
    });
    if (!inventory) {
        return { success: false, message: "棚卸セッションが見つかりません" };
    }
    if (inventory.status !== "IN_PROGRESS") {
        return { success: false, message: "この棚卸は既に完了または中止されています" };
    }

    // トランザクションで在庫を一括更新
    await prisma.$transaction(async (tx) => {
        for (const item of inventory.items) {
            await tx.airconProduct.update({
                where: { id: item.productId },
                data: { stock: item.actualStock },
            });
        }

        await tx.airconInventoryCount.update({
            where: { id },
            data: {
                status: "COMPLETED",
                endedAt: new Date(),
                confirmedBy,
            },
        });
    });

    // 材料在庫を同期
    await syncAirconToMaterialStock();

    revalidatePath("/admin/aircon-inventory");
    const diffs = inventory.items.filter(i => i.adjustment !== 0);
    logOperation("AIRCON_INVENTORY_COMPLETE", `棚卸 #${id}`, `確定 (確認者:${confirmedBy}, 差異:${diffs.length}件)`);
    return { success: true };
}

// 棚卸中止（在庫は変更しない）
export async function cancelAirconInventory(id: number) {
    const inventory = await prisma.airconInventoryCount.findUnique({
        where: { id },
    });
    if (!inventory) {
        return { success: false, message: "棚卸セッションが見つかりません" };
    }
    if (inventory.status !== "IN_PROGRESS") {
        return { success: false, message: "この棚卸は既に完了または中止されています" };
    }

    await prisma.airconInventoryCount.update({
        where: { id },
        data: {
            status: "CANCELLED",
            endedAt: new Date(),
        },
    });

    revalidatePath("/admin/aircon-inventory");
    logOperation("AIRCON_INVENTORY_CANCEL", `棚卸 #${id}`, `エアコン棚卸を中止`);
    return { success: true };
}

// 進行中の棚卸セッションを取得
export async function getActiveAirconInventory() {
    return prisma.airconInventoryCount.findFirst({
        where: { status: "IN_PROGRESS" },
        include: {
            items: {
                include: { product: true },
                orderBy: { product: { code: "asc" } },
            },
        },
    });
}

// 棚卸履歴取得
export async function getAirconInventoryHistory() {
    return prisma.airconInventoryCount.findMany({
        orderBy: { startedAt: "desc" },
        take: 20,
        include: {
            items: {
                include: { product: true },
                orderBy: { product: { code: "asc" } },
            },
        },
    });
}

// エアコン在庫数を取得（持出し画面の上限制御用）
export async function getAirconStockLevels(): Promise<Record<string, number>> {
    const products = await prisma.airconProduct.findMany({
        select: { code: true, stock: true },
        orderBy: { code: "asc" },
    });
    const result: Record<string, number> = {};
    products.forEach(p => { result[p.code] = p.stock; });
    return result;
}

// エアコンログの管理No+顧客名+一時貸出フラグを更新（物件引き当て用）
export async function updateAirconLogAssignment(
    logIds: number[],
    managementNo: string,
    customerName: string,
    contractor?: string,
    isTemporaryLoan?: boolean
) {
    await prisma.airConditionerLog.updateMany({
        where: { id: { in: logIds } },
        data: {
            managementNo,
            customerName,
            contractor: contractor || null,
            isTemporaryLoan: isTemporaryLoan ?? false
        },
    });
    revalidatePath("/admin/aircon-logs");
    logOperation("AIRCON_LOG_ASSIGNMENT", `ログ ${logIds.length}件`, `物件引き当て: 管理No=${managementNo} 顧客=${customerName}${isTemporaryLoan ? ' (一時貸出)' : ''}`);
    return { success: true };
}

