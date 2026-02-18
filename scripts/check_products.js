
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.airconProduct.count();
    console.log('AirconProduct count:', count);

    const products = await prisma.airconProduct.findMany({ take: 5 });
    console.log('Sample products:', JSON.stringify(products, null, 2));

    const stockWithVendor = await prisma.airconProduct.findMany({
        include: {
            logs: {
                where: { isReturned: false },
                include: { vendor: true }
            }
        }
    });
    console.log('Stock query result count:', stockWithVendor.length);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
