'use server';

import { prisma } from '@/lib/prisma';

export type LoginState = {
    message?: string;
    success?: boolean;
};

import { revalidatePath } from 'next/cache';

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

    // TODO: Implement actual stock calculation logic if needed
    // For now, returning simple counts or sums
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
