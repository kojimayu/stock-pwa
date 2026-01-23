'use server';

import { prisma } from '@/lib/prisma';

export type LoginState = {
    message?: string;
    success?: boolean;
};

export async function getVendors() {
    return await prisma.vendor.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
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
