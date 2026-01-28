'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type LoginState = {
    message?: string;
    success?: boolean;
};

// Helper for Logging
async function logOperation(action: string, target: string, details?: string) {
    try {
        await prisma.operationLog.create({
            data: {
                action,
                target,
                details,
            },
        });
    } catch (e) {
        console.error("Failed to create operation log:", e);
        // Logging failure should not block the main action
    }
}

// Vendor Actions
export async function getVendors() {
    return await prisma.vendor.findMany({
        orderBy: { name: 'asc' },
    });
}

// Product Attribute Actions (For Autocomplete)
export async function getUniqueProductAttributes() {
    // We want unique categories, subCategories, suppliers
    // Prisma Distinct is useful here
    const categories = await prisma.product.findMany({
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' }
    });
    const subCategories = await prisma.product.findMany({
        select: { subCategory: true },
        where: { subCategory: { not: null } },
        distinct: ['subCategory'],
        orderBy: { subCategory: 'asc' }
    });
    const suppliers = await prisma.product.findMany({
        select: { supplier: true },
        where: { supplier: { not: null } },
        distinct: ['supplier'],
        orderBy: { supplier: 'asc' }
    });

    return {
        categories: categories.map(c => c.category),
        subCategories: subCategories.map(c => c.subCategory).filter(Boolean) as string[],
        suppliers: suppliers.map(c => c.supplier).filter(Boolean) as string[],
    };
}

export async function upsertVendor(data: { id?: number; name: string; pinCode: string; email?: string | null }) {
    if (data.id) {
        // Update
        await prisma.vendor.update({
            where: { id: data.id },
            data: {
                name: data.name,
                pinCode: data.pinCode,
                email: data.email,
            },
        });
        await logOperation("VENDOR_UPDATE", `Vendor: ${data.name} (ID: ${data.id})`, `Updated profile`);
    } else {
        // Create
        const newVendor = await prisma.vendor.create({
            data: {
                name: data.name,
                pinCode: data.pinCode,
                email: data.email,
            },
        });
        await logOperation("VENDOR_CREATE", `Vendor: ${data.name}`, `Created new vendor`);
    }
    revalidatePath('/admin/vendors');
}

export async function deleteVendor(id: number) {
    // Check if vendor has transactions
    const transactionCount = await prisma.transaction.count({
        where: { vendorId: id },
    });

    if (transactionCount > 0) {
        throw new Error('取引履歴がある業者は削除できません');
    }

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    await prisma.vendor.delete({
        where: { id },
    });

    await logOperation("VENDOR_DELETE", `Vendor: ${vendor?.name || id}`, `Deleted vendor`);
    revalidatePath('/admin/vendors');
}

export async function verifyPin(vendorId: string | number, pin: string) {
    const vendor = await prisma.vendor.findUnique({
        where: { id: Number(vendorId) },
    });

    if (!vendor) {
        return { success: false, message: '業者が存在しません' };
    }

    if (vendor.pinCode !== pin) {
        return { success: false, message: 'PINコードが正しくありません' };
    }

    return { success: true, vendor };
}

export async function loginByPin(pin: string) {
    const vendor = await prisma.vendor.findUnique({
        where: { pinCode: pin },
    });

    if (!vendor) {
        return { success: false, message: 'PINコードが無効です' };
    }

    return { success: true, vendor };
}

// Product Actions
export async function getProducts() {
    return await prisma.product.findMany({
        orderBy: { name: 'asc' },
    });
}

const normalizeCode = (code: string) => {
    if (!code) return "";
    return code
        .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)) // Full-width to Half-width
        .replace(/[-\s]/g, "") // Remove hyphens and spaces
        .toUpperCase();
};

export async function upsertProduct(data: {
    id?: number;
    code: string;
    name: string;
    category: string;
    subCategory?: string | null;
    priceA: number;
    priceB: number;
    priceC: number;
    minStock: number;
    cost: number;
    stock?: number;
    supplier?: string | null;
    color?: string | null;
    unit?: string;
}) {
    // Validation
    // Skip profit check if price is 0 (e.g. initial registration without price)
    if (data.priceA > 0 && data.cost >= data.priceA) throw new Error(`売価A(${data.priceA})が仕入れ値(${data.cost})を下回っています`);
    if (data.priceB > 0 && data.cost >= data.priceB) throw new Error(`売価B(${data.priceB})が仕入れ値(${data.cost})を下回っています`);
    if (data.priceC > 0 && data.cost >= data.priceC) throw new Error(`売価C(${data.priceC})が仕入れ値(${data.cost})を下回っています`);

    const normalizedCode = normalizeCode(data.code);

    if (data.id) {
        // Update (Stock is NOT updated here to preserve inventory integrity, unless we explicitly decide to allow it)
        // For now, we ignore data.stock on update.
        await prisma.product.update({
            where: { id: data.id },
            data: {
                code: normalizedCode,
                name: data.name,
                category: data.category,
                subCategory: data.subCategory,
                priceA: data.priceA,
                priceB: data.priceB,
                priceC: data.priceC,
                minStock: data.minStock,
                cost: data.cost,
                supplier: data.supplier,
                color: data.color,
                unit: data.unit ?? "個",
            },
        });
        await logOperation("PRODUCT_UPDATE", `Product: ${normalizedCode}`, `PriceA: ${data.priceA}, Cost: ${data.cost}`);
    } else {
        // Create
        // Check if code exists (for manual creation safety)
        const existing = await prisma.product.findUnique({ where: { code: normalizedCode } });
        if (existing) {
            throw new Error(`商品ID ${normalizedCode} は既に使用されています`);
        }

        await prisma.product.create({
            data: {
                code: normalizedCode,
                name: data.name,
                category: data.category,
                subCategory: data.subCategory,
                priceA: data.priceA,
                priceB: data.priceB,
                priceC: data.priceC,
                minStock: data.minStock,
                stock: data.stock ?? 0,
                cost: data.cost,
                supplier: data.supplier,
                color: data.color,
                unit: data.unit ?? "個",
            },
        });
        await logOperation("PRODUCT_CREATE", `Product: ${normalizedCode}`, `Created ${data.name}`);
    }
    revalidatePath('/admin/products');
}

// Helper to check for active inventory session
export async function checkActiveInventory() {
    const activeInventory = await prisma.inventoryCount.findFirst({
        where: { status: 'IN_PROGRESS' },
    });
    return !!activeInventory;
}

export async function importProducts(products: {
    code: string;
    name: string;
    category: string;
    subCategory: string;
    priceA: number;
    priceB: number;
    priceC: number;
    minStock: number;
    cost: number;
    supplier?: string | null;
    color?: string | null;
    unit?: string | null;
}[]) {
    // 0. Check for active inventory
    if (await checkActiveInventory()) {
        return { success: false, message: '現在棚卸中のため、商品インポートは利用できません' };
    }

    try {
        // 1. Validation Phase
        const errorDetails: { line: number; message: string; type: 'REQUIRED' | 'PRICE' }[] = [];

        products.forEach((p, index) => {
            const line = index + 1;
            // Required check
            if (!p.code) errorDetails.push({ line, type: 'REQUIRED', message: `${line}行目: 品番(code)がありません` });
            if (!p.name) errorDetails.push({ line, type: 'REQUIRED', message: `${line}行目: 商品名(name)がありません` });
            if (!p.category) errorDetails.push({ line, type: 'REQUIRED', message: `${line}行目: カテゴリー大(category)がありません` });
            if (!p.subCategory) errorDetails.push({ line, type: 'REQUIRED', message: `${line}行目: カテゴリー中(subCategory)がありません` });

            // Cost validation
            if (p.cost >= p.priceA) errorDetails.push({ line, type: 'PRICE', message: `${line}行目: 売価A(${p.priceA})が仕入れ値(${p.cost})以下です` });
            if (p.cost >= p.priceB) errorDetails.push({ line, type: 'PRICE', message: `${line}行目: 売価B(${p.priceB})が仕入れ値(${p.cost})以下です` });
            if (p.priceC > 0 && p.cost >= p.priceC) errorDetails.push({ line, type: 'PRICE', message: `${line}行目: 売価C(${p.priceC})が仕入れ値(${p.cost})以下です` });
        });

        if (errorDetails.length > 0) {
            // Error Message Construction
            let finalMessage = "";
            const THRESHOLD = 5;

            if (errorDetails.length <= THRESHOLD) {
                // Few errors: Show detailed list
                finalMessage = "バリデーションエラー:\n" + errorDetails.map(e => e.message).join('\n');
            } else {
                // Many errors: Show summary
                const requiredCount = errorDetails.filter(e => e.type === 'REQUIRED').length;
                const priceCount = errorDetails.filter(e => e.type === 'PRICE').length;

                finalMessage = `インポートエラー (合計 ${errorDetails.length}件)\n` +
                    `・必須項目未入力: ${requiredCount}件\n` +
                    `・価格設定エラー(原価割れ等): ${priceCount}件\n\n` +
                    `データの確認をお願いします。`;
            }

            return { success: false, message: finalMessage };
        }

        // 2. Execution Phase
        await prisma.$transaction(async (tx) => {
            for (const p of products) {
                const normalizedCode = normalizeCode(p.code);

                // Allow bulk update of prices
                const existing = await tx.product.findUnique({
                    where: { code: normalizedCode },
                });

                if (existing) {
                    await tx.product.update({
                        where: { code: normalizedCode },
                        data: {
                            name: p.name,
                            category: p.category,
                            subCategory: p.subCategory,
                            priceA: p.priceA,
                            priceB: p.priceB,
                            priceC: p.priceC,
                            minStock: p.minStock,
                            cost: p.cost,
                            supplier: p.supplier,
                            color: p.color,
                            unit: p.unit ?? "個",
                        },
                    });
                } else {
                    await tx.product.create({
                        data: {
                            code: normalizedCode,
                            name: p.name,
                            category: p.category,
                            subCategory: p.subCategory,
                            priceA: p.priceA,
                            priceB: p.priceB,
                            priceC: p.priceC,
                            minStock: p.minStock,
                            stock: 0,
                            cost: p.cost,
                            supplier: p.supplier,
                            color: p.color,
                            unit: p.unit ?? "個",
                        },
                    });
                }
            }
        });

        await logOperation("IMPORT", "Batch Import", `Imported/Updated ${products.length} products`);
        revalidatePath('/admin/products');
        return { success: true, count: products.length };
    } catch (error) {
        console.error("Import Error:", error);
        return { success: false, message: error instanceof Error ? error.message : 'インポート中にエラーが発生しました' };
    }
}

export async function deleteProduct(id: number) {
    // Check for transactions or logs
    const transactionCount = await prisma.transaction.count({
        where: { items: { contains: `"productId":${id}` } },
    });
    // Ideally we should also check InventoryLog
    if (transactionCount > 0) {
        throw new Error('取引履歴がある商品は削除できません');
    }

    const product = await prisma.product.findUnique({ where: { id } });
    await prisma.product.delete({
        where: { id },
    });

    await logOperation("PRODUCT_DELETE", `Product: ${product?.code || id}`, `Deleted ${product?.name}`);
    revalidatePath('/admin/products');
}

export async function adjustStock(productId: number, type: string, quantity: number, reason: string) {
    // Transactional update
    await prisma.$transaction(async (tx) => {
        // 1. Create Log
        await tx.inventoryLog.create({
            data: {
                productId,
                type,
                quantity,
                reason,
            },
        });

        // 2. Update Product Stock
        await tx.product.update({
            where: { id: productId },
            data: {
                stock: {
                    increment: quantity,
                },
            },
        });
    });
    revalidatePath('/admin/products');
}

// Dashboard Actions
export async function getTransactions(limit = 100) {
    const transactions = await prisma.transaction.findMany({
        take: limit,
        orderBy: { date: 'desc' },
        include: {
            vendor: true,
        },
    });
    return transactions;
}

export async function getRecentTransactions(limit = 10) {
    return getTransactions(limit);
}

export async function getDashboardStats() {
    const totalTransactions = await prisma.transaction.count();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTransactions = await prisma.transaction.count({
        where: {
            date: {
                gte: today,
            },
        },
    });

    const totalStock = await prisma.product.aggregate({
        _sum: {
            stock: true
        }
    });

    return {
        totalTransactions,
        todayTransactions,
        totalStock: totalStock._sum.stock || 0
    };
}

export async function getAnalysisData() {
    const products = await prisma.product.findMany();

    let totalCost = 0;
    let totalSalesValue = 0;
    const lowMarginProducts = [];

    for (const p of products) {
        totalCost += p.cost * p.stock;
        totalSalesValue += p.priceA * p.stock;

        // Check margin
        const margin = p.priceA > 0 ? ((p.priceA - p.cost) / p.priceA) * 100 : 0;
        if (margin < 10) { // Threshold: 10%
            lowMarginProducts.push({ ...p, margin });
        }
    }

    return {
        totalCost,
        totalSalesValue,
        potentialProfit: totalSalesValue - totalCost,
        lowMarginProducts: lowMarginProducts.sort((a, b) => a.margin - b.margin), // Ascending margin
    };
}

// Import email utility
import { sendTransactionEmail } from './mail';

export async function createTransaction(vendorId: number, items: { productId: number; quantity: number; price: number; name: string; isManual?: boolean }[]) {
    // 0. Check for active inventory
    if (await checkActiveInventory()) {
        throw new Error('現在棚卸中のため、決済処理は利用できません');
    }

    // 1. Calculate total
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const hasUnregisteredItems = items.some((item) => item.isManual);

    // 2. Transactional update (Create Transaction + Decrease Stock + Create Log)
    try {
        const transactionResult = await prisma.$transaction(async (tx) => {
            // Create Transaction Record
            const transaction = await tx.transaction.create({
                data: {
                    vendorId,
                    items: JSON.stringify(items), // Store detailed items as JSON
                    totalAmount,
                    hasUnregisteredItems, // Set flag
                    date: new Date(),
                },
            });

            // Update Stock for each item
            for (const item of items) {
                // Skip stock management for manual items
                if (item.isManual) continue;

                // Check current stock first (optional, but good for safety)
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                if (!product || product.stock < item.quantity) {
                    throw new Error(`商品ID ${item.productId} の在庫が不足しています`);
                }

                // Decrease Stock
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } },
                });

                // Create Inventory Log
                await tx.inventoryLog.create({
                    data: {
                        productId: item.productId,
                        type: '出庫',
                        quantity: -item.quantity, // Negative for outflow
                        reason: `Transaction #${transaction.id}`,
                    },
                });
            }

            return transaction;
        });

        revalidatePath('/admin/products');
        revalidatePath('/admin/transactions');
        revalidatePath('/shop'); // Revalidate shop to update stock display

        // 3. Send Email Notification (Async, don't block response)
        // Fetch vendor to get email
        const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
        if (vendor && vendor.email) {
            console.log(`Attempting to send email to ${vendor.email}`);
            // We don't await this to ensure fast response to UI, or we can await inside a try-catch to log errors but not fail transaction
            // Ideally use a queue, but for now simple async invocation
            sendTransactionEmail(vendor.email, vendor.name, items.map(i => ({ ...i, id: String(i.productId) })), totalAmount)
                .then(() => console.log("Email promise resolved"))
                .catch(err => console.error("Failed to send email:", err));
        } else {
            console.log("No email address found for vendor, skipping email.");
        }

        console.log("Transaction created successfully, returning success.");
        return { success: true };
    } catch (error) {
        console.error("Transaction Error:", error);
        return { success: false, message: error instanceof Error ? error.message : '取引処理中にエラーが発生しました' };
    }
}

// Reconciliation Action
export async function reconcileTransactionItem(transactionId: number, manualItemName: string, targetProductId: number) {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Get Transaction
            const transaction = await tx.transaction.findUnique({
                where: { id: transactionId },
            });
            if (!transaction) throw new Error("取引データが見つかりません");

            const items = JSON.parse(transaction.items) as any[];
            let updated = false;
            let quantityToDeduct = 0;

            // 2. Find and Replace Item (First pass to flag and get quantity)
            let foundIndex = -1;
            for (let i = 0; i < items.length; i++) {
                if (items[i].isManual && items[i].name === manualItemName) {
                    foundIndex = i;
                    updated = true;
                    quantityToDeduct = items[i].quantity;
                    break;
                }
            }

            if (!updated) throw new Error("対象の手入力商品が見つかりません");

            // 3. Fetch Target Product
            const product = await tx.product.findUnique({ where: { id: targetProductId } });
            if (!product) throw new Error("紐付け先の商品が見つかりません");

            // 4. Update the item details
            items[foundIndex] = {
                ...items[foundIndex],
                productId: targetProductId,
                name: product.name,
                price: product.priceA,
                isManual: false
            };

            // 5. Recalculate Total
            const newTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const hasUnregistered = items.some((item) => item.isManual);

            // 6. Update Transaction
            await tx.transaction.update({
                where: { id: transactionId },
                data: {
                    items: JSON.stringify(items),
                    totalAmount: newTotal,
                    hasUnregisteredItems: hasUnregistered,
                }
            });

            // 7. Deduct Stock (Retroactive)
            await tx.product.update({
                where: { id: targetProductId },
                data: { stock: { decrement: quantityToDeduct } }
            });

            // 8. Log
            await tx.inventoryLog.create({
                data: {
                    productId: targetProductId,
                    type: '出庫',
                    quantity: -quantityToDeduct,
                    reason: `Reconciliation Tx #${transactionId}`,
                }
            });
        });

        revalidatePath('/admin/transactions');
        revalidatePath('/admin/products');
        return { success: true };
    } catch (error) {
        console.error("Reconciliation Error:", error);
        return { success: false, message: error instanceof Error ? error.message : '処理に失敗しました' };
    }
}

export async function getVendorTransactions(vendorId: number, limit = 20) {
    const transactions = await prisma.transaction.findMany({
        where: { vendorId },
        orderBy: { date: 'desc' },
        take: limit,
    });
    return transactions;
}

// Operation Logs
export async function getOperationLogs(limit = 100) {
    return await prisma.operationLog.findMany({
        take: limit,
        orderBy: { performedAt: 'desc' },
    });
}

// Inventory Counts
export async function getInventoryCounts() {
    return await prisma.inventoryCount.findMany({
        orderBy: { startedAt: 'desc' },
        include: {
            items: true,
        }
    });
}

export async function createInventoryCount(note?: string) {
    // 1. Snapshot current stock as 'expectedStock'
    const products = await prisma.product.findMany();

    // Create session
    const inventory = await prisma.inventoryCount.create({
        data: {
            status: 'IN_PROGRESS',
            note,
            items: {
                create: products.map(p => ({
                    productId: p.id,
                    expectedStock: p.stock,
                    actualStock: p.stock, // Default to expected, user will adjust
                    adjustment: 0,
                }))
            }
        }
    });

    await logOperation("INVENTORY_START", `Inventory #${inventory.id}`, `Started inventory count`);
    revalidatePath('/admin/inventory');
    return inventory;
}

export async function getInventoryCount(id: number) {
    const inventory = await prisma.inventoryCount.findUnique({
        where: { id },
        include: {
            items: {
                include: {
                    product: true
                },
                orderBy: {
                    product: {
                        code: 'asc'
                    }
                }
            }
        }
    });
    return inventory;
}

export async function updateInventoryItem(itemId: number, actualStock: number) {
    const item = await prisma.inventoryCountItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("Item not found");

    const adjustment = actualStock - item.expectedStock;

    await prisma.inventoryCountItem.update({
        where: { id: itemId },
        data: {
            actualStock,
            adjustment,
        }
    });

    // No log here, only on finalize
}

export async function finalizeInventory(id: number) {
    const inventory = await prisma.inventoryCount.findUnique({
        where: { id },
        include: { items: true }
    });

    if (!inventory || inventory.status !== 'IN_PROGRESS') {
        throw new Error("Invalid inventory session");
    }

    await prisma.$transaction(async (tx) => {
        // 1. Update Inventory Status
        await tx.inventoryCount.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                endedAt: new Date(),
            }
        });

        // 2. Adjust Stock for all items with differences
        for (const item of inventory.items) {
            if (item.adjustment !== 0) {
                // Update Product Stock
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: item.actualStock }
                });

                // Create Adjustment Log
                await tx.inventoryLog.create({
                    data: {
                        productId: item.productId,
                        type: 'INVENTORY_ADJUSTMENT',
                        quantity: item.adjustment,
                        reason: `Inventory #${id} Adjustment`,
                    }
                });
            }
        }
    });

    await logOperation("INVENTORY_FINALIZE", `Inventory #${id}`, `Finalized inventory count`);
    revalidatePath('/admin/inventory');
    revalidatePath(`/admin/inventory/${id}`);
    revalidatePath('/admin/products');
}

export async function cancelInventory(id: number) {
    const inventory = await prisma.inventoryCount.findUnique({
        where: { id },
    });

    if (!inventory || inventory.status !== 'IN_PROGRESS') {
        throw new Error("Invalid inventory session to cancel");
    }

    await prisma.inventoryCount.update({
        where: { id },
        data: {
            status: 'CANCELLED',
            endedAt: new Date(),
        }
    });

    await logOperation("INVENTORY_CANCEL", `Inventory #${id}`, `Cancelled inventory count`);
    revalidatePath('/admin/inventory');
}

// Order Actions (Phase 13)
export async function getOrders() {
    return await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            items: {
                include: {
                    product: true
                }
            }
        }
    });
}

export async function getOrderById(id: number) {
    return await prisma.order.findUnique({
        where: { id },
        include: {
            items: {
                include: {
                    product: true
                }
            }
        }
    });
}

export async function generateDraftOrders() {
    // 1. Get products low on stock (stock < minStock)
    const lowStockProducts = await prisma.product.findMany({
        where: {
            stock: {
                lt: prisma.product.fields.minStock
            },
            minStock: {
                gt: 0
            }
        }
    });

    if (lowStockProducts.length === 0) {
        return { success: false, message: "基準在庫を下回っている商品はありません。" };
    }

    // 2. Group by supplier
    const groupedBySupplier = lowStockProducts.reduce((acc, p) => {
        const supplier = p.supplier || "未指定";
        if (!acc[supplier]) acc[supplier] = [];
        acc[supplier].push(p);
        return acc;
    }, {} as Record<string, typeof lowStockProducts>);

    // 3. Create Draft Orders
    let createdCount = 0;
    for (const [supplier, products] of Object.entries(groupedBySupplier)) {
        await prisma.order.create({
            data: {
                supplier,
                status: 'DRAFT',
                items: {
                    create: products.map(p => ({
                        productId: p.id,
                        quantity: Math.max(0, p.minStock - p.stock + 1), // Default: refill to minStock + 1
                        cost: p.cost,
                    }))
                }
            }
        });
        createdCount++;
    }

    await logOperation("ORDER_DRAFT_GENERATE", `Generated ${createdCount} draft orders`, `Target products: ${lowStockProducts.length}`);
    revalidatePath('/admin/orders');
    return { success: true, message: `${createdCount}件の発注候補を作成しました。` };
}

export async function confirmOrder(id: number) {
    await prisma.order.update({
        where: { id },
        data: { status: 'ORDERED' }
    });
    await logOperation("ORDER_CONFIRM", `Order #${id}`, `Status changed to ORDERED`);
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${id}`);
}

export async function receiveOrderItem(orderItemId: number, quantity: number) {
    // 1. Get the item
    const item = await prisma.orderItem.findUnique({
        where: { id: orderItemId },
        include: { product: true, order: true }
    });

    if (!item) throw new Error("Order item not found");
    if (item.isReceived) throw new Error("Already received");

    // 2. Update item
    const newReceivedQty = item.receivedQuantity + quantity;
    await prisma.orderItem.update({
        where: { id: orderItemId },
        data: {
            receivedQuantity: newReceivedQty,
            isReceived: newReceivedQty >= item.quantity
        }
    });

    // 3. Increase stock
    await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: quantity } }
    });

    // 4. Record Log
    await prisma.inventoryLog.create({
        data: {
            productId: item.productId,
            type: 'RESTOCK',
            quantity: quantity,
            reason: `Order #${item.orderId} Received`,
        }
    });

    // 5. Check order status
    const allItems = await prisma.orderItem.findMany({
        where: { orderId: item.orderId }
    });
    const allDone = allItems.every(i => i.isReceived);

    await prisma.order.update({
        where: { id: item.orderId },
        data: {
            status: allDone ? 'RECEIVED' : 'PARTIAL',
            updatedAt: new Date()
        }
    });

    await logOperation("ORDER_ITEM_RECEIVE", `Order #${item.orderId} Item`, `Product: ${item.product.name}, Qty: ${quantity}`);
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${item.orderId}`);
    revalidatePath('/admin/products');
}

export async function deleteOrder(id: number) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (order?.status !== 'DRAFT') throw new Error("Draft以外の発注書は削除できません");

    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    await prisma.order.delete({ where: { id } });

    await logOperation("ORDER_DELETE", `Order #${id}`, `Deleted draft order`);
    revalidatePath('/admin/orders');
}

export async function updateOrderItemQty(orderItemId: number, quantity: number) {
    await prisma.orderItem.update({
        where: { id: orderItemId },
        data: { quantity }
    });
    // Caller should revalidate
}

