const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Searching for products with color='true'...");

    const products = await prisma.product.findMany({
        where: {
            color: 'true'
        }
    });

    console.log("Found: " + products.length);

    if (products.length > 0) {
        const ids = products.map(p => p.id);
        await prisma.product.deleteMany({
            where: { id: { in: ids } }
        });
        console.log(`Deleted ${ids.length} items.`);
    } else {
        console.log("No items to delete.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
