const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const targetVendorName = 'テスト小島';

    // 1. Find the target vendor
    const vendor = await prisma.vendor.findFirst({
        where: { name: targetVendorName }
    });

    if (!vendor) {
        console.log(`Vendor "${targetVendorName}" not found.`);
        return;
    }

    console.log(`Found Vendor: ${vendor.name} (ID: ${vendor.id})`);

    // 2. Find transactions (AC Logs) linked to this vendor
    const logs = await prisma.airConditionerLog.findMany({
        where: { vendorId: vendor.id },
        include: { airconProduct: true }
    });

    console.log(`Found ${logs.length} transactions to revert.`);

    // 3. Revert Stock & Delete Logs
    for (const log of logs) {
        if (log.airconProduct) {
            console.log(`  Restoring stock for ${log.airconProduct.name} (Current: ${log.airconProduct.stock}) -> +1`);
            await prisma.airconProduct.update({
                where: { id: log.airconProduct.id },
                data: { stock: { increment: 1 } }
            });
        } else {
            console.log(`  No product linked for log ID ${log.id} (Model: ${log.modelNumber}). Skipping stock restore.`);
        }

        console.log(`  Deleting log ID ${log.id}...`);
        await prisma.airConditionerLog.delete({
            where: { id: log.id }
        });
    }

    console.log("Cleanup completed.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
