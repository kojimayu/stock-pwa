import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: お知らせ文を取得
export async function GET() {
    try {
        const config = await prisma.systemConfig.findUnique({
            where: { key: "kiosk_announcement" },
        });
        return NextResponse.json({ value: config?.value || "" });
    } catch (error) {
        return NextResponse.json({ value: "" });
    }
}
