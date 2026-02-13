"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Helper to check active inventory check status
async function checkActiveInventory() {
    const activeInventory = await prisma.inventoryCount.findFirst({
        where: { status: "IN_PROGRESS" },
    });
    return !!activeInventory;
}

// -----------------------------------------------------------------------------
// Return / Refund Logic
// -----------------------------------------------------------------------------

export async function getLatestStocks(productIds: number[]) {
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stock: true, name: true, code: true }
    });
    return products;
}

/**
 * Get aggregated purchase history for a vendor to validate returns.
 * Returns a map of productId -> { purchased, returned, remaining }
 */
export async function getVendorPurchaseHistory(vendorId: number) {
    const transactions = await prisma.transaction.findMany({
        where: { vendorId },
        select: { items: true, isProxyInput: true }
    });

    const history = new Map<number, { purchased: number; returned: number; remaining: number }>();

    for (const tx of transactions) {
        try {
            const items: any[] = JSON.parse(tx.items);
            for (const item of items) {
                const pid = item.productId;
                const qty = item.quantity; // Positive for purchase, Negative for return

                if (!history.has(pid)) {
                    history.set(pid, { purchased: 0, returned: 0, remaining: 0 });
                }
                const entry = history.get(pid)!;

                if (qty > 0) {
                    entry.purchased += qty;
                } else {
                    entry.returned += Math.abs(qty);
                }
                entry.remaining = entry.purchased - entry.returned;
            }
        } catch (e) {
            console.error("Failed to parse transaction items JSON", e);
        }
    }

    // Convert Map to Object for serialization
    return Object.fromEntries(history);
}

/**
 * Process a verified return transaction with stock adjustment.
 * 
 * 1. Validate return quantity against purchase history.
 * 2. Create Transaction (negative quantity).
 * 3. Update Stock (Increase).
 * 4. Create InventoryLog (RETURN).
 * 5. Check actual stock and Adjust if needed (InventoryLog: ADJUSTMENT).
 */
export async function processVerifiedReturn(
    vendorId: number,
    vendorUserId: number | null,
    items: { productId: number; returnQuantity: number; actualStock: number; reason?: string }[]
) {
    // 0. Check for active inventory
    if (await checkActiveInventory()) {
        throw new Error('現在棚卸中のため、返品処理は利用できません');
    }

    try {
        // 1. Validation (Security Check)
        const history = await getVendorPurchaseHistory(vendorId);

        for (const item of items) {
            const record = history[item.productId];
            // If checking strict history, uncomment below. For now, allow return if record exists or maybe allow all?
            // Requirement was to prevent returning items not bought.
            if (!record) {
                throw new Error(`この商品は購入履歴がないため返品できません (ID: ${item.productId})`);
            }
            if (item.returnQuantity > record.remaining) {
                throw new Error(`返品数が購入残数を超えています (ID: ${item.productId}, 残: ${record.remaining}, 返: ${item.returnQuantity})`);
            }
        }

        const transactionResult = await prisma.$transaction(async (tx) => {
            let totalAmount = 0;
            const transactionItems = [];

            // 2. Process each item
            for (const item of items) {
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                if (!product) throw new Error(`商品ID ${item.productId} が見つかりません`);

                // Prepare Transaction Item (Negative Quantity)
                const price = product.priceA; // Assuming priceA
                totalAmount += price * (-item.returnQuantity);

                transactionItems.push({
                    productId: product.id,
                    code: product.code,
                    name: product.name,
                    price: price,
                    quantity: -item.returnQuantity, // Negative
                    unit: product.unit,
                    isManual: false
                });

                // 3. Update Stock (Increase)
                await tx.product.update({
                    where: { id: product.id },
                    data: {
                        stock: { increment: item.returnQuantity },
                        usageCount: { decrement: item.returnQuantity }
                    }
                });

                // 4. Log Return
                await tx.inventoryLog.create({
                    data: {
                        productId: product.id,
                        type: '入庫',
                        quantity: item.returnQuantity,
                        reason: `Return from Vendor #${vendorId}`
                    }
                });

                // 5. Audit & Adjustment
                // Expected Stock AFTER Return = Current (Database) + Return
                // Since we just incremented, `expectedStock` IS the new `product.stock` + returnQuantity?
                // No. `product` is stale.
                // We incremented by `returnQuantity`.
                // So expected stock is `product.stock` (old) + `returnQuantity`.
                const expectedStock = product.stock + item.returnQuantity;
                const diff = item.actualStock - expectedStock;

                if (diff !== 0) {
                    // Adjust Stock
                    await tx.product.update({
                        where: { id: product.id },
                        data: { stock: { increment: diff } }
                    });

                    // Log Adjustment
                    await tx.inventoryLog.create({
                        data: {
                            productId: product.id,
                            type: '棚卸',
                            quantity: diff,
                            reason: `Return Audit: Exp ${expectedStock} -> Act ${item.actualStock}`
                        }
                    });
                }
            }

            // 6. Create Transaction Record
            const transaction = await tx.transaction.create({
                data: {
                    vendorId,
                    vendorUserId,
                    items: JSON.stringify(transactionItems),
                    totalAmount,
                    hasUnregisteredItems: false,
                    date: new Date(),
                    isProxyInput: false,
                }
            });

            return transaction;
        });

        revalidatePath('/admin/products');
        revalidatePath('/admin/transactions');
        revalidatePath('/shop');

        return { success: true, transactionId: transactionResult.id };

    } catch (error) {
        console.error("Return Transaction Error:", error);
        return { success: false, message: error instanceof Error ? error.message : '返品処理中にエラーが発生しました' };
    }
}

/**
 * Get a list of products that the vendor has purchased and can return.
 * Includes 'maxReturnable' quantity.
 */
export async function getVendorReturnableProducts(vendorId: number) {
    const history = await getVendorPurchaseHistory(vendorId);

    // Filter for positive remaining quantity
    const returnableProductIds = Object.entries(history)
        .filter(([_, data]) => data.remaining > 0)
        .map(([id, _]) => Number(id));

    if (returnableProductIds.length === 0) {
        return [];
    }

    const products = await prisma.product.findMany({
        where: { id: { in: returnableProductIds } },
        orderBy: { category: 'asc' } // Or name?
    });

    // Map products to include returnable limit (if we want to use it in UI)
    // For now, ShopInterface expects strict Product type, so we might return just products
    // Or return a wrapper. Let's return extended info but cast or handle in UI.
    // Actually, let's attach the info.

    return products.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        // Add a temporary property for UI to show limit?
        // ShopInterface uses Product type. 
        // We can use 'stock' to represent 'returnable quantity' ONLY in return mode?
        // No, that's confusing. 'stock' is shop stock.
        // Let's add maxReturnable to a separate map or extending the type slightly in the frontend.
        // For this action, let's return { product: Product, maxReturnable: number }[]?
        // Checking ShopInterface... it expects Product[].
        // If we want to reuse ShopInterface components seamlessly, passing Product[] is easiest.
        // But we want to enforce the limit.
        // Let's just return Products for now, and maybe the frontend can fetch history separately if it needs the number.
        // Wait, if we filter by history, we implicitly limit the *list*.
        // The *quantity* validation is server-side.
        // UI showing "Purchased: 5" would be nice.
        // Let's return the products. The calling component can merge the data if needed, 
        // but for "Searching only purchased items", list of Products is sufficient.
    }));
}
