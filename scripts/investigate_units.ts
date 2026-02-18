
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    console.log('--- Product Master Data ---');
    const products = await prisma.product.findMany({
        where: { code: { in: ['VVF203', 'KB360'] } }
    });
    console.log(JSON.stringify(products, null, 2));

    console.log('\n--- Recent Transaction Data ---');
    // Find transaction for 'はなまる空調' or just search for items containing the codes
    const txs = await prisma.transaction.findMany({
        where: {
            items: { contains: 'VVF203' }
        },
        orderBy: { date: 'desc' },
        take: 1,
        include: { vendor: true, vendorUser: true }
    });

    if (txs.length > 0) {
        const tx = txs[0];
        console.log(`Transaction ID: ${tx.id}`);
        console.log(`Vendor: ${tx.vendor.name}, User: ${tx.vendorUser?.name}`);
        console.log(`Date: ${tx.date}`);
        console.log('Items JSON:');
        console.log(JSON.stringify(JSON.parse(tx.items), null, 2));
    } else {
        console.log('No transaction found for VVF203');
    }

    const txs2 = await prisma.transaction.findMany({
        where: {
            items: { contains: 'KB360' }
        },
        orderBy: { date: 'desc' },
        take: 5, // Take more
        include: { vendor: true, vendorUser: true }
    });

    console.log('\n--- KB360 Transactions ---');
    for (const tx of txs2) {
        const items = JSON.parse(tx.items);
        const kb = items.find((i: any) => i.code === 'KB360');
        if (kb) {
            console.log(`ID: ${tx.id}, Date: ${tx.date}, Box: ${kb.isBox}, Price: ${kb.price}, Qty: ${kb.quantity}, Unit: ${kb.unit}`);
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
