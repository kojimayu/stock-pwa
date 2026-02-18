
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    console.log('Linking Orphan Logs...');

    // Get products to match against
    const products = await prisma.airconProduct.findMany();
    console.log(`Loaded ${products.length} products for matching.`);

    // Get orphans
    const orphans = await prisma.airConditionerLog.findMany({
        where: {
            airconProductId: null,
            managementNo: null
        }
    });
    console.log(`Found ${orphans.length} orphans.`);

    for (const log of orphans) {
        // Logic: Find product code that matches start of log.modelNumber
        const model = log.modelNumber;

        // Sort products by code length desc to match longest prefix first
        // e.g. RAS-AJ36 vs RAS-AJ3
        const matchedProduct = products
            .sort((a, b) => b.code.length - a.code.length)
            .find(p => model.startsWith(p.code));

        if (matchedProduct) {
            console.log(`Log ${log.id} (${model}) -> Product ${matchedProduct.id} (${matchedProduct.code})`);
            await prisma.airConditionerLog.update({
                where: { id: log.id },
                data: { airconProductId: matchedProduct.id }
            });
        } else {
            console.warn(`Log ${log.id} (${model}) -> NO MATCH FOUND`);
            // Try fuzzy match? Strip suffix?
            // RAS-AJ3625S -> RAS-AJ36
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
