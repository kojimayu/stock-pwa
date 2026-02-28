import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/**
 * 納品伝票写真を配信するAPIルート
 * Next.js本番モードではビルド後にpublic/に追加されたファイルが
 * 静的配信されないため、このAPIで動的に配信する
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;

    // パストラバーサル防止
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filepath = path.join(process.cwd(), "public", "uploads", "delivery-receipts", filename);

    if (!existsSync(filepath)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    try {
        const buffer = await readFile(filepath);
        const ext = path.extname(filename).toLowerCase();
        const contentType = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }[ext] || "application/octet-stream";

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400", // 1日キャッシュ
            },
        });
    } catch {
        return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
    }
}
