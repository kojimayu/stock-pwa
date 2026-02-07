
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting color migration...');

    const mappings = [
        { old: 'IV', new: 'I' },
        { old: 'BN', new: 'BR' },
        { old: 'BK', new: 'B' },
        { old: 'GY', new: 'G' },
        { old: 'WH', new: 'W' },
    ];

    for (const map of mappings) {
        const result = await prisma.product.updateMany({
            where: { color: map.old },
            data: { color: map.new },
        });
        console.log(`Updated ${map.old} -> ${map.new}: ${result.count} items`);
    }

    console.log('Migration completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
