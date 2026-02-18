
import { PrismaClient } from '@prisma/client';

const prismaTest = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

const prismaDev = new PrismaClient({
    datasources: { db: { url: 'file:./dev.db' } },
});

async function getStockData(prisma: PrismaClient, dbName: string) {
    console.log(`--- ${dbName} Data ---`);
    const products = await prisma.airconProduct.findMany({
        orderBy: { code: 'asc' },
        include: {
            logs: {
                where: { isReturned: false },
            }
        }
    });

    const summary = products.map(p => {
        let set = 0, indoor = 0, outdoor = 0;
        p.logs.forEach(l => {
            if (l.type === 'INDOOR') indoor++;
            else if (l.type === 'OUTDOOR') outdoor++;
            else set++;
        });

        return {
            code: p.code,
            warehouse: p.stock,
            vendor: p.logs.length,
            breakdown: `Set:${set} In:${indoor} Out:${outdoor}`,
            total: p.stock + p.logs.length
        };
    });


    // console.table(summary);
    console.log(JSON.stringify(summary, null, 2));
    return summary;
}

async function main() {
    try {
        console.log('--- Production (DEV) ---');
        const devData = await getStockData(prismaDev, 'DEV');

        console.log('--- Current Environment (TEST) ---');
        const testData = await getStockData(prismaTest, 'TEST');
    } finally {
        await prismaTest.$disconnect();
        await prismaDev.$disconnect();
    }
}

main().catch(console.error);
