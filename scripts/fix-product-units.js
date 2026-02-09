const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Updating product units...");

    // ID 65: IV1.6mm -> Unit: m, QtyPerBox: 300
    const iv = await prisma.product.update({
        where: { id: 65 },
        data: {
            quantityPerBox: 300,
            unit: 'm'
        }
    });
    console.log(`Updated ID 65 (${iv.name}): QtyPerBox=${iv.quantityPerBox}, Unit=${iv.unit}`);

    // ID 66: Vinyl Tape -> Unit: 巻, QtyPerBox: 10, OrderUnit: 200
    const tape = await prisma.product.update({
        where: { id: 66 },
        data: {
            quantityPerBox: 10,
            unit: '巻',
            orderUnit: 200
        }
    });
    console.log(`Updated ID 66 (${tape.name}): QtyPerBox=${tape.quantityPerBox}, Unit=${tape.unit}, OrderUnit=${tape.orderUnit}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
