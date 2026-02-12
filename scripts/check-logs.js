
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const logs = await prisma.operationLog.findMany({
        where: {
            action: 'AUTO_LOGOUT'
        },
        orderBy: {
            performedAt: 'desc'
        },
        take: 10
    });

    console.log('--- Recent Auto Logout Events ---');
    if (logs.length === 0) {
        console.log('No AUTO_LOGOUT events found.');
    } else {
        logs.forEach(log => {
            console.log(`[${log.performedAt.toISOString()}] ${log.target} - ${log.details}`);
        });
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
