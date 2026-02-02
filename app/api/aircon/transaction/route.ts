import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            managementNo,
            customerName,
            contractor,
            items, // 品番の配列
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
                // 品番からエアコン商品を検索（末尾アルファベットを除去してベースコードで検索）
                // 例: RAS-AJ22N → RAS-AJ22
                const baseCode = modelNumber.replace(/[A-Z]$/i, '');

                const airconProduct = await tx.airconProduct.findFirst({
                    where: { code: baseCode }
                });

                // エアコンログを作成
                const log = await tx.airConditionerLog.create({
                    data: {
                        managementNo: String(managementNo),
                        customerName,
                        contractor,
                        modelNumber,
                        vendorId: Number(vendorId),
                        airconProductId: airconProduct?.id || null, // 商品紐付け
                    },
                });
                logs.push(log);

                // 在庫がある場合は減算
                if (airconProduct && airconProduct.stock > 0) {
                    await tx.airconProduct.update({
                        where: { id: airconProduct.id },
                        data: { stock: { decrement: 1 } }
                    });
                }
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
