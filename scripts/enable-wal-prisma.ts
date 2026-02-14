
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Enable WAL mode
        // PRAGMA returns a result, so we must use queryRaw, not executeRaw
        const result = await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
        console.log('WAL mode set. Result:', result);

        // Check current mode again to be sure
        const check = await prisma.$queryRawUnsafe('PRAGMA journal_mode;');
        console.log('Current mode confirmed:', check);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
