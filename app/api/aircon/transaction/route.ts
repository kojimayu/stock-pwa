import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Assuming this exists, based on other files

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            managementNo,
            customerName,
            contractor,
            items, // Changed from modelNumber to items array
            vendorId
        } = body;

        if (!managementNo || !items || !Array.isArray(items) || items.length === 0 || !vendorId) {
            return NextResponse.json(
                { error: 'Missing required fields or empty items' },
                { status: 400 }
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            const logs = [];
            for (const modelNumber of items) {
                const log = await tx.airConditionerLog.create({
                    data: {
                        managementNo: String(managementNo),
                        customerName,
                        contractor,
                        modelNumber,
                        vendorId: Number(vendorId),
                    },
                });
                logs.push(log);
            }
            return logs;
        });

        return NextResponse.json({ success: true, count: result.length });

    } catch (error: any) {
        console.error('AC Transaction Error:', error);
        return NextResponse.json(
            { error: 'Failed to record transaction', details: error.message },
            { status: 500 }
        );
    }
}
