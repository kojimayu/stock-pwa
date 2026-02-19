import { execSync } from 'child_process';
import path from 'path';

/**
 * グローバルセットアップ: テストスイート全体の開始前に1回だけ実行される
 * - Vitest専用のDATABASE_URLを設定（開発DB test.db とは別ファイル）
 * - テスト用DBを初期化（スキーマ適用）
 *
 * 注意: .env.test は開発サーバー（画面テスト）や db:test:push/seed で使う。
 *       Vitest はここで独自に test-vitest.db を使用する。
 */

// Vitest専用のDB設定（開発DBと完全分離）
const VITEST_DB_URL = 'file:./prisma/test-vitest.db';

export async function setup() {
    console.log('\n🔧 [テスト準備] テスト用DBを初期化中...');
    console.log(`   DATABASE_URL: ${VITEST_DB_URL}`);

    // Vitest 子プロセス用に環境変数を設定
    process.env.DATABASE_URL = VITEST_DB_URL;

    const testDbPath = path.resolve(process.cwd(), 'prisma', 'test-vitest.db');

    try {
        // テスト用DBにスキーマを適用（--force-reset で毎回クリーンに）
        execSync('npx prisma db push --force-reset', {
            stdio: 'pipe',
            cwd: process.cwd(),
            env: {
                ...process.env,
                DATABASE_URL: VITEST_DB_URL,
            },
        });
        console.log('✅ [テスト準備] DB初期化完了:', testDbPath);
    } catch (error) {
        console.error('❌ [テスト準備] DB初期化失敗:', error);
        process.exit(1);
    }
}

export async function teardown() {
    console.log('\n🧹 [テスト完了] クリーンアップ終了');
}
