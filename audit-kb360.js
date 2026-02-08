
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const productId = 56; // KB360

    const product = await prisma.product.findUnique({
        where: { id: productId }
    });

    console.log(`=== AUDIT REPORT: ${product.name} (Code: ${product.code}) ===`);
    console.log(`Current DB Stock: ${product.stock}\n`);

    // 1. All Inventory Logs
    const logs = await prisma.inventoryLog.findMany({
        where: { productId },
        orderBy: { createdAt: 'asc' }
    });

    console.log('--- [A] Inventory Logs ---');
    logs.forEach(log => {
        console.log(`[LOG] ${log.createdAt.toISOString()} | Type: ${log.type.padEnd(15)} | Qty: ${String(log.quantity).padStart(5)} | Reason: ${log.reason}`);
    });

    // 2. All Order Items (Receipts)
    // Check if there are any OrderItems linked to this product that are NOT in InventoryLog
    const orderItems = await prisma.orderItem.findMany({
        where: { productId, isReceived: true },
        include: { order: true },
        orderBy: { order: { createdAt: 'asc' } }
    });

    console.log('\n--- [B] Received Order Items (Receipts) ---');
    orderItems.forEach(oi => {
        console.log(`[ORDER] ${oi.order.createdAt.toISOString()} | Order ID: ${oi.orderId} | Qty: ${String(oi.receivedQuantity).padStart(5)} | Cost: ${oi.cost}`);
    });

    // 3. All Transactions (Usage)
    const transactions = await prisma.transaction.findMany({
        orderBy: { date: 'asc' }
    });

    console.log('\n--- [C] Transactions (Search in JSON) ---');
    transactions.forEach(t => {
        try {
            const items = JSON.parse(t.items);
            const match = items.find(item => item.productId === productId);
            if (match) {
                console.log(`[TX] ${t.date.toISOString()} | Tx ID: ${String(t.id).padStart(4)} | Qty: ${String(match.quantity).padStart(5)} | Returned: ${t.isReturned ? 'YES' : 'NO'}`);
            }
        } catch (e) { }
    });

    console.log('\n=== Reconstruction ===');
    // Usually, Stock = Sum(InventoryLogs)
    // Let's see if there are imbalances.
    let sumLogs = 0;
    logs.forEach(l => sumLogs += l.quantity);
    console.log(`Sum of all Inventory Logs: ${sumLogs}`);

    if (sumLogs !== product.stock) {
        console.log(`WARNING: Sum of logs (${sumLogs}) does not match current stock (${product.stock})!`);
    } else {
        console.log(`Check: Sum of logs matches current stock.`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
