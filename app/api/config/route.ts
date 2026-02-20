import { NextResponse } from "next/server";

// テストモード判定API（クライアントから環境変数を参照するため）
export async function GET() {
    const isTestMode = process.env.TEST_MODE === "true";
    const testEmailOverride = process.env.TEST_EMAIL_OVERRIDE || null;

    return NextResponse.json({
        isTestMode,
        testEmailOverride,
    });
}
