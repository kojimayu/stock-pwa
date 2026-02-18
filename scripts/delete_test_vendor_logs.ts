
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    const vendorId = 1; // Test Kojima
    console.log(`Deleting logs for Vendor ID: ${vendorId}...`);

    // Count before
    const countBefore = await prisma.airConditionerLog.count({
        where: { vendorId: vendorId }
    });
    console.log(`Logs before deletion: ${countBefore}`);

    if (countBefore > 0) {
        // Find unreturned items
        const logs = await prisma.airConditionerLog.findMany({
            where: {
                vendorId: vendorId,
                isReturned: false,
                airconProductId: { not: null } // Only if linked to product
            }
        });

        console.log(`Unreturned logs to restore: ${logs.length}`);

        for (const log of logs) {
            if (log.airconProductId) {
                await prisma.airconProduct.update({
                    where: { id: log.airconProductId },
                    data: { stock: { increment: 1 } }
                });
                console.log(`Restored stock for Product ID: ${log.airconProductId}`);
            }
        }

        const deleteResult = await prisma.airConditionerLog.deleteMany({
            where: { vendorId: vendorId }
        });
        console.log(`Deleted ${deleteResult.count} logs.`);

        // Verify
        const countAfter = await prisma.airConditionerLog.count({
            where: { vendorId: vendorId }
        });
        console.log(`Logs after deletion: ${countAfter}`);
    } else {
        console.log('No logs found to delete.');
    }

    // Also check if any stock update is needed?
    // Ideally, deleting logs should return stock?
    // User just said "delete data", implies removing the records.
    // If the items were "checked out" (stock decremented), deleting the log DOES NOT automatically increment stock.
    // This means stock will be permanently lost unless I increment it back.
    // HOWEVER, if it was "test input", maybe the stock reduction was also "test".
    // But to be safe, I should probably ASK or assume he wants to clean up the *transaction* but not necessarily lose the assets.
    // Actually, if I delete the log, I can't return it later.
    // If these are "Vendor Stock" (unreturned), then the physical item is supposedly with the vendor.
    // If I delete the log, the system forgets the vendor has it.
    // Does the item return to warehouse? Or is it gone?

    // If I just delete the log, the `stock` count in `AirconProduct` remains as is (decremented).
    // This means the item is "lost" from the system (neither in warehouse nor with vendor).
    // The user said "Test input", so probably he wants to undo the test. 
    // Undoing the test implies putting the stock back to the warehouse.

    // I should check if they are returned or not.
    // If `isReturned: false`, I should probably increment the stock back?
    // Let's modify the script to return stock for unreturned items before deleting.
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
