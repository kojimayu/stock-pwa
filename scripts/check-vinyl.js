
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const p = await prisma.product.findUnique({
        where: { id: 66 }
    });
    console.log(p);
}

check();
