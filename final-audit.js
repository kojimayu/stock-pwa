
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const productId = 56;
    const logs = await prisma.inventoryLog.findMany({ where: { productId }, orderBy: { createdAt: 'asc' } });
    const txs = await prisma.transaction.findMany({ orderBy: { date: 'asc' } });
    const product = await prisma.product.findUnique({ where: { id: productId } });

    console.log('--- START AUDIT DATA ---');
    console.log('PRODUCT_NAME: ' + product.name);
    console.log('PRODUCT_STOCK: ' + product.stock);

    logs.forEach((l, i) => {
        console.log(`LOG_${i}: ${JSON.stringify(l)}`);
    });

    const relevantTxs = txs.filter(t => {
        const items = JSON.parse(t.items);
        return items.some(i => i.productId === productId);
    });

    relevantTxs.forEach((t, i) => {
        const items = JSON.parse(t.items);
        const item = items.find(it => it.productId === productId);
        console.log(`TX_${i}: ${JSON.stringify({ id: t.id, date: t.date, qty: item.quantity, items_raw: t.items })}`);
    });
    console.log('--- END AUDIT DATA ---');
}
main().catch(console.error).finally(() => prisma.$disconnect());
