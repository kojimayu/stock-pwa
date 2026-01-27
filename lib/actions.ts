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
    supplier?: string | null;
    color?: string | null;
}) {
    // Validation
    if (data.cost >= data.priceA) throw new Error(`売価A(${data.priceA})が仕入れ値(${data.cost})を下回っています`);
    if (data.cost >= data.priceB) throw new Error(`売価B(${data.priceB})が仕入れ値(${data.cost})を下回っています`);
    if (data.priceC > 0 && data.cost >= data.priceC) throw new Error(`売価C(${data.priceC})が仕入れ値(${data.cost})を下回っています`);

    const normalizedCode = normalizeCode(data.code);

    if (data.id) {
        // Update (Stock is NOT updated here)
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
            },
        });
        await logOperation("PRODUCT_UPDATE", `Product: ${normalizedCode}`, `PriceA: ${data.priceA}, Cost: ${data.cost}`);
    } else {
        // Create (Initial stock is 0)
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
                stock: 0,
                cost: data.cost,
                supplier: data.supplier,
                color: data.color,
            },
        });
        await logOperation("PRODUCT_CREATE", `Product: ${normalizedCode}`, `Created ${data.name}`);
    }
    revalidatePath('/admin/products');
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
}[]) {
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
