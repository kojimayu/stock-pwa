
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    console.log('Inspecting NULL ManagementNo Records...');

    const records = await prisma.airConditionerLog.findMany({
        where: { managementNo: null },
        include: { airconProduct: true }
    });

    console.log(`Found ${records.length} records with managementNo: null.`);

    if (records.length > 0) {
        console.log('Sample Data (First 5):');
        records.slice(0, 5).forEach(r => {
            console.log(`ID: ${r.id}, Returned: ${r.isReturned}, ProductID: ${r.airconProductId}, Model: ${r.modelNumber}`);
        });

        // Count unreturned
        const unreturned = records.filter(r => !r.isReturned);
        console.log(`Unreturned NULL records: ${unreturned.length}`);

        unreturned.forEach(r => {
            console.log(`Unreturned ID: ${r.id}, Model: ${r.modelNumber}, ProductID: ${r.airconProductId}`);
        });
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
