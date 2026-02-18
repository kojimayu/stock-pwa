
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    console.log('Searching for "Test" or "Kojima" vendors...');

    const vendors = await prisma.vendor.findMany({
        where: {
            OR: [
                { name: { contains: 'Test' } },
                { name: { contains: 'test' } },
                { name: { contains: 'テスト' } },
                { name: { contains: '小島' } }
            ]
        },
        include: {
            users: true,
            // logs: true // If relation is missing, this fails.
        }
    });

    console.log(`Found ${vendors.length} vendors.`);

    for (const v of vendors) {
        const logCount = await prisma.airConditionerLog.count({ where: { vendorId: v.id } });
        console.log(`ID: ${v.id}, Name: ${v.name}, Logs: ${logCount}, Users: ${v.users.map(u => u.name).join(', ')}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
