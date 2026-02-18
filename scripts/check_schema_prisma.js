
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const result = await prisma.$queryRaw`PRAGMA table_info(AirConditionerLog);`;
    console.log(JSON.stringify(result, (key, value) =>
        typeof value === 'bigint'
            ? value.toString()
            : value
        , 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
