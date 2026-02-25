import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncAirconToMaterialStock, getActiveAirconInventory } from '@/lib/aircon-actions';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log("Transaction Request Body:", JSON.stringify(body, null, 2)); // Debug log
        const {
            managementNo,
            customerName,
            contractor,
            items, // 品番の配列
            vendorId,
            vendorUserId, // Added: Handle vendorUserId from request
            type = 'SET',  // Added: Default type to 'SET'
            isProxyInput = false, // 代理入力フラグ
            note = null, // メモ欄
            transactionDate = null // 代理入力用：引取日
        } = body;

        if (!managementNo || !items || !Array.isArray(items) || items.length === 0 || !vendorId) {
            return NextResponse.json(
                { error: 'Missing required fields or empty items' },
                { status: 400 }
            );
        }

        // 🔒 エアコン棚卸中チェック: 棚卸進行中はエアコン持出しをブロック
        const activeInventory = await getActiveAirconInventory();
        if (activeInventory) {
            return NextResponse.json(
                { error: '現在エアコン棚卸中のため、持出し処理は利用できません' },
                { status: 403 }
            );
        }

        // 🔒 在庫事前チェック: 全商品の在庫を確認してから処理開始
        // 品番→ベースコードのマッピングと必要数を集計
        const stockRequirements = new Map<string, { code: string, needed: number, models: string[] }>();
        for (const modelNumber of items) {
            let baseCode = modelNumber.replace(/[A-Z]$/i, '');
            const ajMatch = modelNumber.match(/^(RAS-AJ\d{2})/);
            if (ajMatch) baseCode = ajMatch[1];

            const existing = stockRequirements.get(baseCode);
            if (existing) {
                existing.needed++;
                existing.models.push(modelNumber);
            } else {
                stockRequirements.set(baseCode, { code: baseCode, needed: 1, models: [modelNumber] });
            }
        }

        // 在庫確認
        const shortages: string[] = [];
        for (const [baseCode, req] of stockRequirements) {
            const product = await prisma.airconProduct.findFirst({ where: { code: baseCode } });
            if (product && product.stock < req.needed) {
                shortages.push(`${product.name || baseCode}: 在庫${product.stock}台に対し${req.needed}台指定`);
            }
        }
        if (shortages.length > 0) {
            return NextResponse.json(
                { error: '在庫不足のため持出しできません', details: shortages.join('、') },
                { status: 400 }
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            const logs = [];

            for (const modelNumber of items) {
                let baseCode = modelNumber.replace(/[A-Z]$/i, '');
                const ajMatch = modelNumber.match(/^(RAS-AJ\d{2})/);
                if (ajMatch) baseCode = ajMatch[1];

                const airconProduct = await tx.airconProduct.findFirst({
                    where: { code: baseCode }
                });

                const log = await tx.airConditionerLog.create({
                    data: {
                        managementNo: String(managementNo),
                        customerName,
                        contractor,
                        modelNumber,
                        vendorId: Number(vendorId),
                        airconProductId: airconProduct?.id || null,
                        vendorUserId: vendorUserId ? Number(vendorUserId) : null,
                        type: type,
                        isProxyInput: Boolean(isProxyInput),
                        note: note || null,
                        ...(transactionDate ? { createdAt: new Date(transactionDate) } : {}),
                    },
                });
                logs.push(log);

                if (airconProduct) {
                    await tx.airconProduct.update({
                        where: { id: airconProduct.id },
                        data: { stock: { decrement: 1 } }
                    });
                }
            }
            return logs;
        });

        // 材料在庫を同期（エアコン在庫変動分を反映）
        await syncAirconToMaterialStock();

        return NextResponse.json({ success: true, count: result.length });

    } catch (error: any) {
        console.error('AC Transaction Error:', error);
        return NextResponse.json(
            { error: 'Failed to record transaction', details: error.message },
            { status: 500 }
        );
    }
}
