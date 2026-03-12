const { execSync } = require('child_process');
const path = require('path');

// テストDBの絶対パス
const testDbPath = 'file:' + path.resolve('./dev-browser-test.db').replace(/\\/g, '/');
console.log('テストDB:', testDbPath);

// マイグレーション適用
try {
    execSync(`npx prisma migrate deploy`, {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: testDbPath },
        stdio: 'inherit',
    });
    console.log('マイグレーション完了');
} catch (e) {
    console.error('マイグレーション失敗、dbpushで試みます...');
    try {
        execSync(`npx prisma db push --accept-data-loss`, {
            cwd: process.cwd(),
            env: { ...process.env, DATABASE_URL: testDbPath },
            stdio: 'inherit',
        });
        console.log('db push 完了');
    } catch (e2) {
        console.error('db push も失敗:', e2.message);
    }
}
