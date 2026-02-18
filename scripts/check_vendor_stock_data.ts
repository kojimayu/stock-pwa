
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    // Check for "自社在庫" or similar
    const vendorStockCandidates = await prisma.airConditionerLog.findMany({
        where: {
            OR: [
                { managementNo: { contains: '自社' } },
                { managementNo: { contains: '在庫' } },
                { customerName: { contains: '自社' } },
                { customerName: { contains: '在庫' } }
            ],
            isReturned: false
        }
    });

    console.log(`Found ${vendorStockCandidates.length} potential vendor stock records.`);

    if (vendorStockCandidates.length > 0) {
        console.log('Sample records:');
        vendorStockCandidates.slice(0, 5).forEach(log => {
            console.log(`ID: ${log.id}, MgmtNo: ${log.managementNo}, Customer: ${log.customerName}, Vendor: ${log.vendorId}`);
        });
    }

    // Also check distinct management numbers just in case
    const allLogs = await prisma.airConditionerLog.findMany({
        where: { isReturned: false },
        select: { managementNo: true }
    });

    const distinctMgmtNos = [...new Set(allLogs.map(l => l.managementNo))];
    console.log('Distinct Management Nos (Unreturned):', distinctMgmtNos);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
