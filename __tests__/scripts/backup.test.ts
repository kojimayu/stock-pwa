/**
 * バックアップ整合性テスト (backup.test.ts)
 *
 * テスト対象:
 * - タスクスケジューラの自動バックアップが正常に動作しているか
 * - バックアップファイルが実際に復元可能な状態かどうか
 *
 * 検証項目:
 * 1. 直近48時間以内のバックアップファイルが存在すること
 * 2. バックアップファイルが0バイトでないこと
 * 3. SQLiteヘッダーが正しいこと
 * 4. Prisma経由でDBに接続しクエリ実行できること（復元可能性）
 * 5. 主要テーブルにデータが存在すること
 *
 * 背景: 以前バックアップは動いていたがファイル不備で復旧できなかったため追加
 */

import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// バックアップフォルダ候補（タスクスケジューラ用 → ローカル）
const BACKUP_FOLDERS = [
    'C:\\Users\\Kojima\\pluscompany,\\pluscompany, - ドキュメント\\General\\Dev\\stock-pwa\\バックアップ\\db',
    path.resolve(__dirname, '../../backups'),
];

// 最新のバックアップDBファイルを探す
function findLatestBackup(): { filePath: string; folder: string; ageHours: number; fileName: string } | null {
    for (const folder of BACKUP_FOLDERS) {
        if (!fs.existsSync(folder)) continue;

        const files = fs.readdirSync(folder)
            .filter(f => /^dev_\d{8}_\d{6}\.db$/.test(f))
            .map(f => ({
                name: f,
                path: path.join(folder, f),
                mtime: fs.statSync(path.join(folder, f)).mtimeMs,
            }))
            .sort((a, b) => b.mtime - a.mtime);

        if (files.length > 0) {
            const ageHours = (Date.now() - files[0].mtime) / (1000 * 60 * 60);
            return { filePath: files[0].path, folder, ageHours, fileName: files[0].name };
        }
    }
    return null;
}

describe('バックアップ整合性チェック — 自動バックアップの検証', () => {
    const backup = findLatestBackup();
    let prismaBackup: PrismaClient | null = null;

    afterAll(async () => {
        if (prismaBackup) {
            await prismaBackup.$disconnect();
        }
    });

    it('✅ 存在確認: 直近48時間以内のバックアップファイルが存在する', () => {
        expect(backup).not.toBeNull();
        if (backup) {
            console.log(`最新バックアップ: ${backup.fileName} (${backup.ageHours.toFixed(1)}時間前, ${backup.folder})`);
        }
        // 48時間以上バックアップがない場合は自動バックアップが停止している
        expect(backup!.ageHours).toBeLessThan(48);
    });

    it('✅ サイズ確認: バックアップファイルが有効なサイズである', () => {
        expect(backup).not.toBeNull();
        const stats = fs.statSync(backup!.filePath);
        console.log(`ファイルサイズ: ${(stats.size / 1024).toFixed(1)} KB`);
        // 最低10KB以上ないと空DBの可能性が高い
        expect(stats.size).toBeGreaterThan(10 * 1024);
    });

    it('✅ ヘッダー確認: SQLite形式のファイルである', () => {
        expect(backup).not.toBeNull();
        const buffer = Buffer.alloc(16);
        const fd = fs.openSync(backup!.filePath, 'r');
        fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);

        // SQLiteファイルは "SQLite format 3\0" で始まる
        const header = buffer.toString('ascii', 0, 15);
        expect(header).toBe('SQLite format 3');
    });

    it('✅ 復元確認: Prisma経由でDBに接続しクエリを実行できる', async () => {
        expect(backup).not.toBeNull();

        // バックアップDBにPrismaで接続（読み取りのみ）
        const backupDbUrl = `file:${backup!.filePath.replace(/\\/g, '/')}`;
        prismaBackup = new PrismaClient({
            datasources: { db: { url: backupDbUrl } },
        });

        // 接続テスト（SELECT 1）
        const result = await prismaBackup.$queryRawUnsafe('SELECT 1 as ok') as { ok: bigint }[];
        expect(Number(result[0].ok)).toBe(1);
    });

    it('✅ テーブル確認: 主要テーブルが存在しアクセス可能', async () => {
        expect(prismaBackup).not.toBeNull();

        // 主要テーブルのCOUNTクエリ
        const tables = ['Product', 'Vendor', 'AirconProduct', 'Transaction'];
        for (const table of tables) {
            const count = await prismaBackup!.$queryRawUnsafe(
                `SELECT COUNT(*) as cnt FROM "${table}"`
            ) as { cnt: number }[];
            console.log(`  ${table}: ${count[0].cnt} 件`);
            // テーブルアクセスが可能であること（件数は0でもOK）
            expect(count[0].cnt).toBeGreaterThanOrEqual(0);
        }
    });

    it('✅ データ確認: 商品・業者データが存在する（空DB排除）', async () => {
        expect(prismaBackup).not.toBeNull();

        // Product テーブルにデータがあるか（空のDBはバックアップ不備の可能性）
        const productCount = await prismaBackup!.$queryRawUnsafe(
            'SELECT COUNT(*) as cnt FROM "Product"'
        ) as { cnt: bigint }[];
        expect(Number(productCount[0].cnt)).toBeGreaterThan(0);

        // Vendor テーブルにデータがあるか
        const vendorCount = await prismaBackup!.$queryRawUnsafe(
            'SELECT COUNT(*) as cnt FROM "Vendor"'
        ) as { cnt: bigint }[];
        expect(Number(vendorCount[0].cnt)).toBeGreaterThan(0);
    });
});
