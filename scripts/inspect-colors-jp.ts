
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for products by color name...');

    const colors = ['アイボリー', 'ブラウン', 'ブラック', 'ホワイト', 'グレー'];

    for (const c of colors) {
        const products = await prisma.product.findMany({
            where: { color: c },
            take: 5,
            select: { id: true, code: true, name: true, color: true }
        });
        console.log(`Results for ${c}:`, JSON.stringify(products, null, 2));
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
