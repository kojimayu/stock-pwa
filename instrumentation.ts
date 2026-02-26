export async function register() {
    // サーバー起動時にDB接続先を表示（安全確認用）
    const dbUrl = process.env.DATABASE_URL || '(未設定)';
    const isTestDb = dbUrl.includes('test-vitest') || dbUrl.includes('test.db');

    console.log('\n====================================');
    console.log(`📁 DATABASE_URL: ${dbUrl}`);
    if (isTestDb) {
        console.log('\x1b[31m⚠️  WARNING: テストDBに接続しています！\x1b[0m');
    } else {
        console.log('✅ 本番DBに接続');
    }
    console.log('====================================\n');
}
