
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const productId = 56;
    const logs = await prisma.inventoryLog.findMany({ where: { productId } });
    const sum = logs.reduce((acc, l) => acc + l.quantity, 0);
    const product = await prisma.product.findUnique({ where: { id: productId } });

    console.log(`Log Sum: ${sum}`);
    console.log(`Product Stock: ${product.stock}`);
    console.log('--- Log Details ---');
    logs.forEach(l => console.log(`${l.createdAt.toISOString()} | ${l.quantity} | ${l.type} | ${l.reason}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
