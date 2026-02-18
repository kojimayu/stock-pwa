
import { PrismaClient } from '@prisma/client';

const prismaDev = new PrismaClient({
    datasources: { db: { url: 'file:../dev.db' } }, // Relative to where script is run? No, PrismaClient resolves relative to schema or cwd.
    // Actually, standard PrismaClient reads from env.
    // To override, I need to be careful.
    // If I run from root, 'file:./dev.db' should work.
});

// Since I can't easily start two completely separate PrismaClients with different schema locations (they share the generated client code),
// I will reuse the generated client but override the datasource URL.
// The generated client is customized for the schema. Since schema is same, it works.

const prismaTest = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

const prismaSource = new PrismaClient({
    datasources: { db: { url: 'file:./dev.db' } },
});

async function main() {
    console.log('Reading from dev.db...');

    const vendors = await prismaSource.vendor.findMany({ include: { users: true } });
    console.log(`Found ${vendors.length} vendors.`);

    const products = await prismaSource.airconProduct.findMany();
    console.log(`Found ${products.length} products.`);

    const logs = await prismaSource.airConditionerLog.findMany();
    console.log(`Found ${logs.length} logs.`);

    console.log('Writing to test.db...');

    // 1. Vendors & Users
    for (const v of vendors) {
        await prismaTest.vendor.upsert({
            where: { id: v.id },
            update: {
                name: v.name,
                isActive: v.isActive
            },
            create: {
                id: v.id,
                name: v.name,
                isActive: v.isActive
            },
        });

        for (const u of v.users) {
            await prismaTest.vendorUser.upsert({
                where: { id: u.id },
                update: {
                    name: u.name,
                    pinCode: u.pinCode,
                    vendorId: v.id,
                    pinChanged: u.pinChanged
                },
                create: {
                    id: u.id,
                    name: u.name,
                    pinCode: u.pinCode,
                    vendorId: v.id,
                    pinChanged: u.pinChanged
                },
            });
        }
    }

    // 2. Products
    for (const p of products) {
        await prismaTest.airconProduct.upsert({
            where: { id: p.id },
            update: {
                code: p.code,
                name: p.name,
                capacity: p.capacity,
                suffix: p.suffix,
                stock: p.stock,
                minStock: p.minStock,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            },
            create: {
                id: p.id,
                code: p.code,
                name: p.name,
                capacity: p.capacity,
                suffix: p.suffix,
                stock: p.stock,
                minStock: p.minStock,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            },
        });
    }

    // 2.5 Update VendorUser with products if needed - REMOVED (Field no longer exists)
    // for (const v of vendors) {
    //     for (const u of v.users) {
    //         if ((u as any).airconProductId) {
    //             console.warn('Skipping airconProductId for user ' + u.id);
    //         }
    //     }
    // }

    // 3. Logs
    for (const l of logs) {
        await prismaTest.airConditionerLog.upsert({
            where: { id: l.id },
            update: {
                managementNo: l.managementNo,
                customerName: l.customerName,
                contractor: l.contractor,
                modelNumber: l.modelNumber,
                vendorId: l.vendorId,
                vendorUserId: l.vendorUserId,
                type: l.type,
                airconProductId: l.airconProductId,
                isReturned: l.isReturned,
                returnedAt: l.returnedAt,
                createdAt: l.createdAt
            },
            create: {
                id: l.id,
                managementNo: l.managementNo,
                customerName: l.customerName,
                contractor: l.contractor,
                modelNumber: l.modelNumber,
                vendorId: l.vendorId,
                vendorUserId: l.vendorUserId,
                type: l.type,
                airconProductId: l.airconProductId,
                isReturned: l.isReturned,
                returnedAt: l.returnedAt,
                createdAt: l.createdAt
            },
        });
    }

    console.log('Import completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prismaTest.$disconnect();
        await prismaSource.$disconnect();
    });
