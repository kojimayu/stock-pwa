
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.operationLog.findMany({
    take: 20,
    orderBy: {
      performedAt: 'desc',
    },
  });

  console.log('--- Recent Operation Logs ---');
  logs.forEach(log => {
    console.log(`[${log.performedAt.toISOString()}] ${log.action} - ${log.target} (${log.details})`);
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
