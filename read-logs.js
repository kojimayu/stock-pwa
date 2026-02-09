const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const logs = await prisma.operationLog.findMany({
        orderBy: { performedAt: 'desc' },
        take: 20
    });

    console.log("--- Latest Operation Logs ---");
    logs.forEach(log => {
        console.log(`[${log.performedAt.toISOString()}] ${log.action} | ${log.target} | ${log.details}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
