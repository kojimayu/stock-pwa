import { NextResponse } from 'next/server';

// ビルド時に環境変数から注入されるバージョン情報を返す
export async function GET() {
    return NextResponse.json({
        commitHash: process.env.NEXT_PUBLIC_BUILD_COMMIT || 'unknown',
        branch: process.env.NEXT_PUBLIC_BUILD_BRANCH || 'unknown',
        buildDate: process.env.NEXT_PUBLIC_BUILD_DATE || 'unknown',
    });
}
