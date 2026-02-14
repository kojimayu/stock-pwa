
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const logs = await prisma.operationLog.findMany({
        take: 50,
        orderBy: { performedAt: 'desc' },
    });

    console.log("--- Recent Operation Logs ---");
    logs.forEach(log => {
        console.log(`[${log.performedAt.toISOString()}] ${log.action}: ${log.target} (${log.details})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
