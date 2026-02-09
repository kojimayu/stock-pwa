const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const startOfDay = new Date('2026-02-09T00:00:00+09:00');
    const endOfDay = new Date('2026-02-09T23:59:59+09:00');

    console.log(`Searching logs between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}...`);

    const logs = await prisma.airConditionerLog.findMany({
        where: {
            createdAt: {
                gte: startOfDay,
                lte: endOfDay
            }
        },
        include: {
            vendor: true,
            airconProduct: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    console.log(`Found ${logs.length} logs.`);

    for (const log of logs) {
        console.log(`[${log.createdAt.toLocaleString()}]`);
        console.log(`  Vendor: ${log.vendor.name} (ID: ${log.vendorId})`);
        console.log(`  Product: ${log.airconProduct?.name} (Stock: ${log.airconProduct?.stock})`);
        console.log(`  Model: ${log.modelNumber}`);
        console.log(`  MgmtNo: ${log.managementNo}`);
        console.log('---');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
