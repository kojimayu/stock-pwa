import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Assuming this exists, based on other files

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            managementNo,
            customerName,
            contractor,
            modelNumber,
            vendorId
        } = body;

        if (!managementNo || !modelNumber || !vendorId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const log = await prisma.airConditionerLog.create({
            data: {
                managementNo,
                customerName,
                contractor,
                modelNumber,
                vendorId: Number(vendorId),
            },
        });

        return NextResponse.json({ success: true, log });

    } catch (error: any) {
        console.error('AC Transaction Error:', error);
        return NextResponse.json(
            { error: 'Failed to record transaction', details: error.message },
            { status: 500 }
        );
    }
}
