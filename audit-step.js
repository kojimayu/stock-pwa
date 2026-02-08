
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const productId = 56;

    // Fetch all events
    const logs = await prisma.inventoryLog.findMany({
        where: { productId },
        orderBy: { createdAt: 'asc' }
    });

    const txs = await prisma.transaction.findMany({
        orderBy: { date: 'asc' }
    });

    const product = await prisma.product.findUnique({
        where: { id: productId }
    });

    console.log('--- RECONSTRUCTION FOR PRODUCT 56 (KB360) ---');

    const events = [];

    logs.forEach(l => {
        events.push({
            date: l.createdAt,
            type: 'LOG',
            subtype: l.type,
            qty: l.quantity,
            reason: l.reason
        });
    });

    txs.forEach(t => {
        const items = JSON.parse(t.items);
        const match = items.find(i => i.productId === productId);
        if (match) {
            events.push({
                date: t.date,
                type: 'TX',
                subtype: '出庫(記録のみ)',
                qty: -match.quantity,
                id: t.id
            });
        }
    });

    // Sort all events by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    let total = 0;
    events.forEach(e => {
        if (e.type === 'LOG') {
            total += e.qty;
        }
        console.log(`[${e.date.toISOString()}] ${e.type.padEnd(4)} | ${String(e.qty).padStart(4)} | Total: ${String(total).padStart(4)} | ${e.subtype.padEnd(15)} | ${e.reason || e.id || ''}`);
    });

    console.log(`\nFinal DB Balance: ${product.stock}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
