
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.$queryRawUnsafe('PRAGMA journal_mode;');
    console.log('Journal Mode:', result);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
