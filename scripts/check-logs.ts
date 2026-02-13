
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24); // Last 24 hours
    console.log(`Checking logs since ${cutoff.toISOString()}...`);

    const logs = await prisma.operationLog.findMany({
        where: {
            action: { in: ['LOGIN', 'KIOSK_LOGIN_SUCCESS', 'KIOSK_LOGIN_FAILED'] },
            performedAt: { gte: cutoff }
        },
        orderBy: { performedAt: 'desc' },
        take: 20
    });

    console.log(`Found ${logs.length} login-related logs.`);

    for (const log of logs) {
        console.log(`[${log.performedAt.toISOString()}] ${log.action} - Target: ${log.target} - Details: ${log.details}`);
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
