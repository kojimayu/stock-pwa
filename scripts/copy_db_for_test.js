const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const srcDb = path.resolve('./dev.db');
const testDb = path.resolve('./dev-browser-test.db');

// 1. 既存のテストDBを削除
for (const ext of ['', '-wal', '-shm']) {
    const f = testDb + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
}

// 2. VACUUM INTOで本番DBをコピー（WALも含めて統合）
console.log('[1/3] 本番DBをVACUUM INTOでコピー...');
try {
    execSync(`npx prisma db execute --url "file:${srcDb.replace(/\\/g, '/')}" --stdin`, {
        input: `PRAGMA wal_checkpoint(TRUNCATE); VACUUM INTO '${testDb.replace(/\\/g, '/')}';`,
        cwd: process.cwd(),
        stdio: ['pipe', 'inherit', 'inherit'],
    });
    console.log('   コピー成功');
} catch (e) {
    console.error('   VACUUM INTO 失敗');
    process.exit(1);
}

// 3. テストDBにスキーマを同期（db push --accept-data-loss なし）
console.log('[2/3] テストDBにスキーマ同期...');
const testDbUrl = 'file:' + testDb.replace(/\\/g, '/');
try {
    execSync(`npx prisma db push`, {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: testDbUrl },
        stdio: 'inherit',
    });
    console.log('   スキーマ同期成功');
} catch (e) {
    console.log('   通常のdb pushが失敗。対話的プロンプトを自動承認で再試行...');
    try {
        // echo y でプロンプトに自動回答
        execSync(`echo y | npx prisma db push`, {
            cwd: process.cwd(),
            env: { ...process.env, DATABASE_URL: testDbUrl },
            stdio: 'inherit',
            shell: true,
        });
        console.log('   スキーマ同期成功（自動承認）');
    } catch (e2) {
        console.error('   スキーマ同期失敗:', e2.message);
        process.exit(1);
    }
}

// 4. データ確認
console.log('[3/3] データ確認...');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
p.vendor.count().then(c => {
    console.log('   Vendor数:', c);
    return p.product.count();
}).then(c => {
    console.log('   Product数:', c);
    return p.transaction.count();
}).then(c => {
    console.log('   Transaction数:', c);
    console.log('✅ テストDB準備完了');
    return p.$disconnect();
}).catch(e => {
    console.error('   データ確認エラー:', e.message);
    p.$disconnect();
});
