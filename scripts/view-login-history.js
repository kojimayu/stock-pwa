
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const logs = await prisma.operationLog.findMany({
        where: {
            action: {
                in: ['LOGIN', 'LOGOUT', 'AUTO_LOGOUT', 'ADMIN_LOGIN']
            }
        },
        orderBy: {
            performedAt: 'desc'
        },
        take: 20
    });

    console.log('--- Login/Logout History (Last 20) ---');
    if (logs.length === 0) {
        console.log('No login history found.');
    } else {
        logs.forEach(log => {
            // Format date to JST-like string (simplified)
            const date = new Date(log.performedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
            console.log(`[${date}] ${log.action.padEnd(12)} | ${log.target} | ${log.details || ''}`);
        });
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
