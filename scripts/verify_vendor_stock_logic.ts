
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    console.log('Verifying Vendor Stock Logic (ManagementNo IS NULL)...');

    const products = await prisma.airconProduct.findMany({
        include: {
            logs: {
                where: {
                    isReturned: false,
                    managementNo: null
                },
                include: { vendor: true }
            }
        }
    });

    console.log(`Found ${products.length} products.`);

    for (const p of products) {
        const allLogs = await prisma.airConditionerLog.count({ where: { airconProductId: p.id } });
        const nullLogs = await prisma.airConditionerLog.count({ where: { airconProductId: p.id, managementNo: null } });
        const activeNullLogs = p.logs.length;

        console.log(`Product: ${p.code} | Total Logs: ${allLogs} | Null MgmtNo: ${nullLogs} | Active Null MgmtNo (Vendor Stock): ${activeNullLogs}`);

        if (activeNullLogs > 0) {
            // Breakdown
            const breakdown = p.logs.reduce((acc, log) => {
                const vendorName = log.vendor?.name || 'Unknown';
                acc[vendorName] = (acc[vendorName] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            Object.entries(breakdown).forEach(([name, count]) => {
                console.log(`  - ${name}: ${count}`);
            });
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
