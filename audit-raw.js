
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const productId = 56;

    const logs = await prisma.inventoryLog.findMany({
        where: { productId },
        orderBy: { createdAt: 'asc' }
    });

    console.log('--- ALL INVENTORY LOGS ---');
    logs.forEach(l => {
        console.log(`JSON_START${JSON.stringify(l)}JSON_END`);
    });

    const txs = await prisma.transaction.findMany({
        orderBy: { date: 'asc' }
    });

    console.log('\n--- ALL RELEVANT TRANSACTIONS ---');
    txs.forEach(t => {
        const items = JSON.parse(t.items);
        if (items.some(i => i.productId === productId)) {
            console.log(`JSON_START${JSON.stringify({ id: t.id, date: t.date, items: items.filter(i => i.productId === productId) })}JSON_END`);
        }
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
