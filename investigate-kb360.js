
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const productCode = 'KB360';

    // 1. Find product
    const product = await prisma.product.findUnique({
        where: { code: productCode },
        include: {
            inventoryLogs: {
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    if (!product) {
        console.log(`Product with code ${productCode} not found.`);
        return;
    }

    console.log(`--- Product Information: ${product.name} (${product.code}) ---`);
    console.log(`Current Stock: ${product.stock}`);
    console.log(`Product ID: ${product.id}`);

    // 2. Inventory Logs (Adjustments/Initial)
    console.log('\n--- Inventory Logs (Stock Adjustments) ---');
    product.inventoryLogs.forEach(log => {
        console.log(`[${log.createdAt.toISOString()}] Type: ${log.type}, Qty: ${log.quantity}, Reason: ${log.reason}`);
    });

    // 3. Transactions (Usage)
    // Transactions store items as a JSON string in the 'items' column
    const transactions = await prisma.transaction.findMany({
        orderBy: { date: 'desc' }
    });

    console.log('\n--- Transaction History (Usage) ---');
    let totalUsed = 0;
    transactions.forEach(t => {
        try {
            const items = JSON.parse(t.items);
            const match = items.find(item => item.productId === product.id);
            if (match) {
                console.log(`[${t.date.toISOString()}] Transaction ID: ${t.id}, Qty: ${match.quantity}`);
                totalUsed += match.quantity;
            }
        } catch (e) {
            // Ignore invalid JSON
        }
    });

    console.log(`\nTotal Usage from Transactions: ${totalUsed}`);

    // Logic: Initial + Sum(Logs) - TotalUsed = Current
    // But usually, initial is the first Log or the stock value at creation.
    // We need to look at the first 'INITIAL' or 'STOCKTAKING' log.
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
