
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Clear existing data
    await prisma.transaction.deleteMany();
    // CartItem model does not exist in schema.prisma, skipping.
    await prisma.vendorUser.deleteMany();
    await prisma.vendor.deleteMany();

    // Create Test Vendor
    const vendor = await prisma.vendor.create({
        data: {
            name: 'テスト施工業者',
            isActive: true,
            accessCompanyName: 'test-company',
        },
    });

    // Create Test User
    await prisma.vendorUser.create({
        data: {
            name: 'テスト太郎',
            pinCode: '1234',
            pinChanged: true, // Already changed
            vendorId: vendor.id,
        },
    });

    console.log('Test database seeded');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
