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

export async function upsertVendor(data: { id?: number; name: string; pinCode: string }) {
    if (data.id) {
        // Update
        await prisma.vendor.update({
            where: { id: data.id },
            data: {
                name: data.name,
                pinCode: data.pinCode,
            },
        });
    } else {
        // Create
        await prisma.vendor.create({
            data: {
                name: data.name,
                pinCode: data.pinCode,
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

// Product Actions
export async function getProducts() {
    return await prisma.product.findMany({
        orderBy: { name: 'asc' },
    });
}

export async function upsertProduct(data: { id?: number; name: string; category: string; priceA: number; priceB: number; minStock: number }) {
    if (data.id) {
        // Update (Stock is NOT updated here)
        await prisma.product.update({
            where: { id: data.id },
            data: {
                name: data.name,
                category: data.category,
                priceA: data.priceA,
                priceB: data.priceB,
                minStock: data.minStock,
            },
        });
    } else {
        // Create (Initial stock is 0)
        await prisma.product.create({
            data: {
                name: data.name,
                category: data.category,
                priceA: data.priceA,
                priceB: data.priceB,
                minStock: data.minStock,
                stock: 0,
            },
        });
    }
    revalidatePath('/admin/products');
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
export async function getRecentTransactions(limit = 10) {
    const transactions = await prisma.transaction.findMany({
        take: limit,
        orderBy: { date: 'desc' },
        include: {
            vendor: true,
        },
    });
    return transactions;
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
