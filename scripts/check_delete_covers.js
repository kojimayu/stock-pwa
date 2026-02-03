const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            category: { contains: '化粧カバー' },
            OR: [
                { name: { contains: '屋外' } },
                { subCategory: { contains: '屋外' } },
                { subCategory: { contains: '直線' } } // Assuming KD70 is straight pipe
            ]
        }
    });

    console.log("Total: " + products.length);

    const colorless = products.filter(p => !p.color || p.color === 'true'); // Check for null, empty, or weird 'true'
    console.log("Colorless/Invalid: " + colorless.length);

    if (colorless.length > 0) {
        const ids = colorless.map(p => p.id);
        await prisma.product.deleteMany({
            where: { id: { in: ids } }
        });
        console.log(`Deleted ${ids.length} items: ${ids.join(', ')}`);
    } else {
        console.log("No items to delete.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
