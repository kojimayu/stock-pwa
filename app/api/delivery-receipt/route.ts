import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/actions";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "delivery-receipts");

// POST: 納品伝票写真アップロード + 情報保存（複数写真対応）
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll("photos") as File[];
        const type = formData.get("type") as string; // "MATERIAL" or "AIRCON"
        const orderId = parseInt(formData.get("orderId") as string);
        const confirmedBy = formData.get("confirmedBy") as string | null;
        const deliveryDate = formData.get("deliveryDate") as string | null;
        const note = formData.get("note") as string | null;

        if (!type || !orderId) {
            return NextResponse.json({ error: "type と orderId は必須です" }, { status: 400 });
        }

        // 複数写真を保存
        const photoPaths: string[] = [];
        const validFiles = files.filter(f => f && f.size > 0);

        if (validFiles.length > 0) {
            await mkdir(UPLOAD_DIR, { recursive: true });

            for (const file of validFiles) {
                const timestamp = Date.now();
                const rand = Math.random().toString(36).substring(2, 6);
                const ext = file.name.split(".").pop() || "jpg";
                const filename = `${type.toLowerCase()}_${orderId}_${timestamp}_${rand}.${ext}`;
                const filepath = path.join(UPLOAD_DIR, filename);

                const bytes = await file.arrayBuffer();
                const buffer = Buffer.from(bytes);
                await writeFile(filepath, buffer);

                photoPaths.push(`/api/delivery-receipt/image/${filename}`);
            }
        }

        // DB保存（写真パスはJSON配列として保存、1枚の場合は単独パス）
        const photoPath = photoPaths.length > 1
            ? JSON.stringify(photoPaths)
            : photoPaths[0] || null;

        const receipt = await prisma.deliveryReceipt.create({
            data: {
                type,
                orderId,
                photoPath,
                confirmedBy: confirmedBy || null,
                confirmedAt: new Date(),
                deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
                note: note || null,
            },
        });

        const label = type === "AIRCON" ? "エアコン" : "材料";
        await logOperation(
            "DELIVERY_RECEIPT",
            `${label}発注 #${orderId}`,
            `納品確認 確認者: ${confirmedBy || '不明'}, 写真: ${photoPaths.length}枚`
        );

        return NextResponse.json({ success: true, receipt });
    } catch (error) {
        console.error("Delivery receipt error:", error);
        return NextResponse.json(
            { error: "納品記録の保存に失敗しました" },
            { status: 500 }
        );
    }
}

// GET: 指定発注の納品記録取得
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const orderId = searchParams.get("orderId");

    if (!type || !orderId) {
        return NextResponse.json({ error: "type と orderId は必須です" }, { status: 400 });
    }

    const receipts = await prisma.deliveryReceipt.findMany({
        where: {
            type,
            orderId: parseInt(orderId),
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(receipts);
}
