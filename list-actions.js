const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const actions = await prisma.operationLog.groupBy({
        by: ['action'],
        _count: { action: true }
    });

    console.log("--- Unique Actions in OperationLog ---");
    actions.forEach(a => {
        console.log(`${a.action}: ${a._count.action}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
