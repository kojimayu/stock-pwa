
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const items = await prisma.orderItem.findMany({
        where: {
            productId: { in: [62, 65] }
        },
        orderBy: { id: 'desc' },
        take: 20
    });

    console.log("Recent Order Items:");
    items.forEach(i => {
        console.log(`[ID ${i.id}] Product: ${i.productId}, Qty: ${i.quantity}, Cost: ${i.cost}, Received: ${i.receivedQuantity}`);
    });
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
