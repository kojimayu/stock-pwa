'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type LoginState = {
    message?: string;
    success?: boolean;
};

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
    } else {
        // Create
        await prisma.vendor.create({
            data: {
                name: data.name,
                pinCode: data.pinCode,
                email: data.email,
            },
        });
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

    await prisma.vendor.delete({
        where: { id },
    });
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
    priceA: number;
    priceB: number;
    minStock: number;
    cost: number;
    supplier?: string | null;
    color?: string | null;
}) {
    const normalizedCode = normalizeCode(data.code);

    if (data.id) {
        // Update (Stock is NOT updated here)
        await prisma.product.update({
            where: { id: data.id },
            data: {
                code: normalizedCode,
                name: data.name,
                category: data.category,
                priceA: data.priceA,
                priceB: data.priceB,
                minStock: data.minStock,
                cost: data.cost,
                supplier: data.supplier,
                color: data.color,
            },
        });
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
                priceA: data.priceA,
                priceB: data.priceB,
                minStock: data.minStock,
                stock: 0,
                cost: data.cost,
                supplier: data.supplier,
                color: data.color,
            },
        });
    }
    revalidatePath('/admin/products');
}

export async function importProducts(products: {
    code: string;
    name: string;
    category: string;
    priceA: number;
    priceB: number;
    minStock: number;
    cost: number;
    supplier?: string | null;
    color?: string | null;
}[]) {
    try {
        await prisma.$transaction(async (tx) => {
            for (const p of products) {
                const normalizedCode = normalizeCode(p.code);

                // Upsert by code
                const existing = await tx.product.findUnique({
                    where: { code: normalizedCode },
                });

                if (existing) {
                    await tx.product.update({
                        where: { code: normalizedCode },
                        data: {
                            name: p.name,
                            category: p.category,
                            priceA: p.priceA,
                            priceB: p.priceB,
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
                            priceA: p.priceA,
                            priceB: p.priceB,
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

    await prisma.product.delete({
        where: { id },
    });
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

export async function createTransaction(vendorId: number, items: { productId: number; quantity: number; price: number; name: string }[]) {
    // 1. Calculate total
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // 2. Transactional update (Create Transaction + Decrease Stock + Create Log)
    try {
        const transactionResult = await prisma.$transaction(async (tx) => {
            // Create Transaction Record
            const transaction = await tx.transaction.create({
                data: {
                    vendorId,
                    items: JSON.stringify(items), // Store detailed items as JSON
                    totalAmount,
                    date: new Date(),
                },
            });

            // Update Stock for each item
            for (const item of items) {
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
                        quantity: -item.quantity,
                        reason: 'Kiosk Purchase',
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
