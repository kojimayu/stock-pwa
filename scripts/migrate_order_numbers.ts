
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting migration: Backfill Order Numbers...');

    // 1. Get max existing order number
    const maxOrder = await prisma.order.findFirst({
        where: { orderNumber: { not: null } },
        orderBy: { orderNumber: 'desc' },
    });
    let nextNumber = (maxOrder?.orderNumber ?? 0) + 1;
    console.log(`Current max order number: ${maxOrder?.orderNumber ?? 0}. Next: ${nextNumber}`);

    // 2. Find orders that need migration (Status != DRAFT, orderNumber is null)
    const orders = await prisma.order.findMany({
        where: {
            status: { not: 'DRAFT' },
            orderNumber: null,
        },
        orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${orders.length} orders to migrate.`);

    // 3. Update each order
    for (const order of orders) {
        console.log(`Updating Order ID ${order.id} (${order.status}, ${order.createdAt.toISOString()}) -> #${nextNumber}`);
        await prisma.order.update({
            where: { id: order.id },
            data: { orderNumber: nextNumber },
        });
        nextNumber++;
    }

    console.log('Migration completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
