
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    const count = await prisma.transaction.count();
    console.log(`Transaction count in test.db: ${count}`);

    if (count > 0) {
        const txs = await prisma.transaction.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { vendor: true } });
        console.log('Recent transactions:', JSON.stringify(txs, null, 2));
    } else {
        console.log('No transactions found.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
