const { PrismaClient } = require('@prisma/client');

async function main() {
    // テストDBの中身を確認
    const prisma = new PrismaClient({
        datasources: { db: { url: 'file:./dev-browser-test.db' } }
    });
    try {
        const tables = await prisma.$queryRawUnsafe(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        console.log('テストDB テーブル一覧:');
        tables.forEach(t => console.log('  -', t.name));
        console.log(`合計: ${tables.length} テーブル`);
    } catch (e) {
        console.error('エラー:', e.message);
    } finally {
        await prisma.$disconnect();
    }

    // 本番DBも確認
    const prisma2 = new PrismaClient({
        datasources: { db: { url: 'file:./dev.db' } }
    });
    try {
        const tables = await prisma2.$queryRawUnsafe(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        console.log('\n本番DB テーブル一覧:');
        tables.forEach(t => console.log('  -', t.name));
        console.log(`合計: ${tables.length} テーブル`);
    } catch (e) {
        console.error('エラー:', e.message);
    } finally {
        await prisma2.$disconnect();
    }
}
main();
