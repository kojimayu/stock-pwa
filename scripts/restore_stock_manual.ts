
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    console.log('Restoring stock for deleted Test Kojima logs...');

    // Adjustment values based on previous verification output
    // RAS-AJ22: 5
    // RAS-AJ25: 4
    // RAS-AJ28: 4
    // RAS-AJ36: 4

    const adjustments = [
        { code: 'RAS-AJ22', amount: 5 },
        { code: 'RAS-AJ25', amount: 4 },
        { code: 'RAS-AJ28', amount: 4 },
        { code: 'RAS-AJ36', amount: 4 }
    ];

    for (const adj of adjustments) {
        // Find product by code prefix
        const product = await prisma.airconProduct.findFirst({
            where: { code: { startsWith: adj.code } }
        });

        if (product) {
            console.log(`Updating ${product.code}: Stock ${product.stock} -> ${product.stock + adj.amount}`);
            await prisma.airconProduct.update({
                where: { id: product.id },
                data: { stock: { increment: adj.amount } }
            });
        } else {
            console.warn(`Product not found for code prefix: ${adj.code}`);
        }
    }

    console.log('Stock restoration completed.');
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
