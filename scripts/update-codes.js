const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const updates = [
        { from: 'FW38S', to: 'W38FS' },
        { from: 'NW38S', to: 'W38NS' },
        { from: 'WW38S', to: 'W38WS' },
    ];

    for (const u of updates) {
        try {
            const result = await prisma.product.update({
                where: { code: u.from },
                data: { code: u.to }
            });
            console.log('Updated:', u.from, '->', u.to);
        } catch (e) {
            console.log('Skipped (not found or error):', u.from);
        }
    }
}

main().then(() => prisma.$disconnect());
