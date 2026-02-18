
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    console.log('Migrating "INTERNAL" management numbers to NULL...');

    const result = await prisma.airConditionerLog.updateMany({
        where: {
            managementNo: 'INTERNAL',
        },
        data: {
            managementNo: null,
        },
    });

    console.log(`Updated ${result.count} records.`);

    // Also check if there are other placeholders like "在庫" etc.
    // The user mentioned "INTERNAL" specifically.

    // Verify
    const nullCount = await prisma.airConditionerLog.count({
        where: { managementNo: null }
    });
    console.log(`Log records with managementNo = NULL: ${nullCount}`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
