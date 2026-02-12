
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    // 62: VVF, 65: IV
    const items = await prisma.transactionItem.findMany({
        where: {
            productId: { in: [62, 65] }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    console.log("Recent Transactions:");
    items.forEach(i => {
        console.log(`[${i.createdAt.toISOString()}] Product: ${i.productId}, Qty: ${i.quantity}, Price: ${i.price}, isBox: ${i.isBox}, QtyPerBox: ${i.quantityPerBox}`);
    });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
