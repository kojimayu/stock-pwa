const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting transaction code backfill...');

    // 1. Fetch all products to create a lookup map
    const products = await prisma.product.findMany();
    const productMap = new Map();
    products.forEach(p => {
        productMap.set(p.id, p.code);
    });
    console.log(`Loaded ${products.length} products.`);

    // 2. Fetch all transactions
    const transactions = await prisma.transaction.findMany({
        orderBy: { id: 'asc' }
    });
    console.log(`Found ${transactions.length} transactions.`);

    let updatedCount = 0;

    for (const tx of transactions) {
        let items = [];
        try {
            items = JSON.parse(tx.items);
        } catch (e) {
            console.error(`Failed to parse items for transaction #${tx.id}:`, e);
            continue;
        }

        let hasChanges = false;
        const updatedItems = items.map(item => {
            // If code is missing and we have a productId
            if (!item.code && item.productId) {
                const code = productMap.get(item.productId);
                if (code) {
                    item.code = code;
                    hasChanges = true;
                }
            }
            return item;
        });

        if (hasChanges) {
            await prisma.transaction.update({
                where: { id: tx.id },
                data: {
                    items: JSON.stringify(updatedItems)
                }
            });
            // console.log(`Updated Transaction #${tx.id}`);
            updatedCount++;
        }
    }

    console.log(`Backfill complete. Updated ${updatedCount} transactions.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
