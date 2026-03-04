import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: 指定商品IDのstock+requireStockCheck情報を返す
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
        return NextResponse.json({ products: [] });
    }

    const ids = idsParam.split(",").map(Number).filter(Boolean);

    try {
        const products = await prisma.product.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                stock: true,
                requireStockCheck: true,
                unit: true,
            },
        });
        return NextResponse.json({ products });
    } catch (error) {
        return NextResponse.json({ products: [] });
    }
}
