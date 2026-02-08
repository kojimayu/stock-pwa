
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const productId = 56; // KB360

    const product = await prisma.product.findUnique({
        where: { id: productId }
    });

    console.log(`--- Investigating ${product.name} (ID: ${productId}) ---`);
    console.log(`Current Stock in DB: ${product.stock}\n`);

    // 1. All Inventory Logs
    const logs = await prisma.inventoryLog.findMany({
        where: { productId },
        orderBy: { createdAt: 'asc' }
    });

    console.log('--- Inventory Logs (Timeline) ---');
    let runningStock = 0;
    logs.forEach(log => {
        runningStock += log.quantity;
        console.log(`[${log.createdAt.toISOString()}] ${log.type.padEnd(20)} | Qty: ${String(log.quantity).padStart(4)} | Running: ${String(runningStock).padStart(4)} | Reason: ${log.reason}`);
    });

    // 2. All Transactions involving this product
    const transactions = await prisma.transaction.findMany({
        orderBy: { date: 'asc' }
    });

    console.log('\n--- Transactions Found in items column ---');
    transactions.forEach(t => {
        try {
            const items = JSON.parse(t.items);
            const match = items.find(item => item.productId === productId);
            if (match) {
                console.log(`[${t.date.toISOString()}] ID: ${String(t.id).padStart(3)} | Qty: ${String(match.quantity).padStart(3)} | Returned: ${t.isReturned ? 'YES' : 'NO'}`);
            }
        } catch (e) { }
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
