const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            category: { contains: '化粧カバー' },
            // Assuming 'outdoor' might be in the name or subcategory
            OR: [
                { name: { contains: '屋外' } },
                { subCategory: { contains: '屋外' } }
            ]
        }
    });

    console.log("Found " + products.length + " products.");
    products.forEach(p => {
        console.log(`${p.id}: ${p.name} (Color: ${p.color}) [${p.code}]`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
