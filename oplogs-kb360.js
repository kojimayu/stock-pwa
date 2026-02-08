
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const productId = 56;
    const logs = await prisma.operationLog.findMany({
        where: {
            OR: [
                { target: { contains: 'Product ID: 56' } },
                { target: { contains: 'Product: 56' } },
                { details: { contains: 'Product ID: 56' } },
                { details: { contains: 'ProductID: 56' } }
            ]
        },
        orderBy: { performedAt: 'asc' }
    });

    console.log('--- Operation Logs for Product 56 ---');
    logs.forEach(l => {
        console.log(`[${l.performedAt.toISOString()}] ${l.action} | ${l.target} | ${l.details}`);
    });
}
main().catch(console.error).finally(() => prisma.$disconnect());
