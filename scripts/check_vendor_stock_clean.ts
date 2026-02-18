
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    const allLogs = await prisma.airConditionerLog.findMany({
        where: { isReturned: false },
        select: { managementNo: true, customerName: true }
    });

    const distinctMgmtNos = [...new Set(allLogs.map(l => l.managementNo))];
    console.log('--- Distinct Management Nos ---');
    distinctMgmtNos.forEach(no => console.log(`"${no}"`));

    console.log('\n--- Records with "自社" or "在庫" or "予備" ---');
    const vendorStock = allLogs.filter(l =>
        l.managementNo.includes('自社') ||
        l.managementNo.includes('在庫') ||
        l.managementNo.includes('予備') ||
        (l.customerName && (l.customerName.includes('自社') || l.customerName.includes('在庫') || l.customerName.includes('予備')))
    );

    vendorStock.forEach(l => console.log(`MgmtNo: "${l.managementNo}", Customer: "${l.customerName}"`));
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
