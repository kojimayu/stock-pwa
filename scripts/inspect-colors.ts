
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for products with color codes...');

    const suffixes = ['IV', 'BN', 'BK', 'GY', 'WH'];

    for (const suffix of suffixes) {
        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { code: { endsWith: `-${suffix}` } },
                    { name: { contains: suffix } } // Just in case
                ]
            },
            take: 5,
            select: { id: true, code: true, name: true, color: true }
        });
        console.log(`Results for ${suffix}:`, JSON.stringify(products, null, 2));
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
