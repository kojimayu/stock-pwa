const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking relations for products with color='true'...");

    // 1. Identify invalid products
    const products = await prisma.product.findMany({
        where: { color: 'true' },
        include: {
            _count: {
                select: {
                    countItems: true,   // Correct relation name
                    inventoryLogs: true,
                    orderItems: true
                }
            }
        }
    });

    console.log("Found: " + products.length + " invalid products.");

    if (products.length === 0) {
        console.log("No invalid products found.");
        return;
    }

    const ids = products.map(p => p.id);

    // 2. Cascade Delete Dependencies
    console.log("Deleting dependencies...");

    // Inventory Logs
    const deletedLogs = await prisma.inventoryLog.deleteMany({
        where: { productId: { in: ids } }
    });
    console.log(`Deleted ${deletedLogs.count} InventoryLogs.`);

    // Inventory Count Items
    const deletedItems = await prisma.inventoryCountItem.deleteMany({
        where: { productId: { in: ids } }
    });
    console.log(`Deleted ${deletedItems.count} InventoryCountItems.`);

    // Order Items
    const deletedOrderItems = await prisma.orderItem.deleteMany({
        where: { productId: { in: ids } }
    });
    console.log(`Deleted ${deletedOrderItems.count} OrderItems.`);

    // 3. Delete Products
    console.log("Deleting Products...");
    const deletedProducts = await prisma.product.deleteMany({
        where: { id: { in: ids } }
    });
    console.log(`Deleted ${deletedProducts.count} Products.`);
}

main()
    .catch(e => {
        console.error("Error executing cleanup:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
