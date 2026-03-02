import { NextRequest, NextResponse } from "next/server";
import { resolveAdminName } from "@/lib/admin-utils";

/**
 * メールアドレスから管理者名を取得するAPI
 * クライアントからlocalStorageに名前を保存するために使用
 */
export async function GET(request: NextRequest) {
    const email = request.nextUrl.searchParams.get("email");
    if (!email) {
        return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const name = resolveAdminName(email);
    return NextResponse.json({ name });
}
