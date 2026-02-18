import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const logs = await prisma.airConditionerLog.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                vendor: {
                    select: { name: true }
                },
                vendorUser: { // Added: Include vendorUser name
                    select: { name: true }
                }
            },
            take: 500, // 最大500件
        });

        return NextResponse.json({ logs });
    } catch (error: any) {
        console.error('Failed to fetch aircon logs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch logs', details: error.message },
            { status: 500 }
        );
    }
}
