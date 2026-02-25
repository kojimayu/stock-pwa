import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const managementNo = searchParams.get('managementNo');

        const logs = await prisma.airConditionerLog.findMany({
            where: managementNo ? { managementNo } : undefined,
            orderBy: { createdAt: 'desc' },
            include: {
                vendor: {
                    select: { name: true }
                },
                vendorUser: {
                    select: { name: true }
                }
            },
            take: managementNo ? 10 : 500,
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
