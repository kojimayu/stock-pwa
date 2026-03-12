const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
    const testDbPath = path.resolve('./dev-browser-test.db');

    // 既存のテストDBを削除
    for (const ext of ['', '-wal', '-shm']) {
        const p = testDbPath + ext;
        if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    // 本番DBに接続してWALをチェックポイント→VACUUM INTO
    const prisma = new PrismaClient({
        datasources: { db: { url: 'file:./dev.db' } }
    });

    try {
        // WALの内容を本体DBにマージ（PASSIVE = 本番の読み書きをブロックしない）
        await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(PASSIVE)');
        console.log('WALチェックポイント完了');

        // VACUUM INTO でクリーンコピー作成
        await prisma.$executeRawUnsafe(`VACUUM INTO '${testDbPath.replace(/\\/g, '/')}'`);
        console.log('VACUUM INTO 完了');

        // コピーしたDBのテーブル数を検証
        const prisma2 = new PrismaClient({
            datasources: { db: { url: `file:${testDbPath.replace(/\\/g, '/')}` } }
        });
        const tables = await prisma2.$queryRawUnsafe(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        console.log(`テストDB テーブル数: ${tables.length}`);
        if (tables.length === 0) {
            console.error('エラー: テーブルが空です。ファイルコピーにフォールバック...');
            await prisma2.$disconnect();

            // フォールバック: WALをマージしてからファイルコピー
            await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
            console.log('WAL TRUNCATE チェックポイント完了');
            fs.copyFileSync('./dev.db', testDbPath);
            console.log('ファイルコピーでテストDB作成完了');
        } else {
            console.log('テストDB作成成功!');
            tables.forEach(t => console.log('  -', t.name));
            await prisma2.$disconnect();
        }
    } catch (e) {
        console.error('エラー:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
