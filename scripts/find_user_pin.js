
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.vendorUser.findMany({
        where: {
            name: {
                contains: '太郎'
            }
        },
        include: {
            vendor: true
        }
    });

    console.log('Found users:', JSON.stringify(users, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
