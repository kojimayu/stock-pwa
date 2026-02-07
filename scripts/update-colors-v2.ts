
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting V2 color code migration...');

    const mappings = [
        { color: 'アイボリー', oldSuffix: 'IV', newSuffix: 'I' },
        { color: 'ブラウン', oldSuffix: 'BN', newSuffix: 'BR' },
        { color: 'ブラック', oldSuffix: 'BK', newSuffix: 'B' },
        { color: 'グレー', oldSuffix: 'GY', newSuffix: 'G' },
        { color: 'ホワイト', oldSuffix: 'WH', newSuffix: 'W' },
    ];

    for (const map of mappings) {
        const products = await prisma.product.findMany({
            where: {
                color: map.color,
                code: { endsWith: map.oldSuffix }
            }
        });

        console.log(`Found ${products.length} items for ${map.color} (${map.oldSuffix} -> ${map.newSuffix})`);

        let updatedCount = 0;
        for (const p of products) {
            // Replace suffix 
            // Note: slice instead of replace to ensure we only target the end
            const newCode = p.code.slice(0, -map.oldSuffix.length) + map.newSuffix;

            try {
                await prisma.product.update({
                    where: { id: p.id },
                    data: { code: newCode }
                });
                updatedCount++;
                process.stdout.write('.');
            } catch (e) {
                console.error(`\nFailed to update ${p.code} to ${newCode}:`, e);
            }
        }
        console.log(`\nUpdated ${updatedCount} items.`);
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
