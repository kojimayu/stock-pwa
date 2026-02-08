
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const productId = 56; // KB360

    const product = await prisma.product.findUnique({
        where: { id: productId }
    });

    console.log(`=== KB360 STOCK AUDIT ===`);

    // 1. Logs
    const logs = await prisma.inventoryLog.findMany({
        where: { productId },
        orderBy: { createdAt: 'asc' }
    });

    console.log('\n--- Inventory Logs ---');
    let current = 0;
    logs.forEach(l => {
        current += l.quantity;
        console.log(`[${l.createdAt.toISOString()}] ${String(l.quantity).padStart(5)} | Running: ${String(current).padStart(5)} | ${l.type} | ${l.reason}`);
    });

    // 2. OrderItems
    const orderItems = await prisma.orderItem.findMany({
        where: { productId, isReceived: true },
        include: { order: true }
    });
    console.log('\n--- Received Orders ---');
    orderItems.forEach(oi => {
        console.log(`[${oi.order.createdAt.toISOString()}] +${oi.receivedQuantity} | OrderID: ${oi.orderId}`);
    });

    // 3. Transactions
    const txs = await prisma.transaction.findMany({
        orderBy: { date: 'asc' }
    });
    console.log('\n--- Usage in Transactions ---');
    txs.forEach(t => {
        const items = JSON.parse(t.items);
        const match = items.find(i => i.productId === productId);
        if (match) {
            console.log(`[${t.date.toISOString()}] -${match.quantity} | TxID: ${t.id}`);
        }
    });

    console.log(`\nFinal DB Stock: ${product.stock}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
