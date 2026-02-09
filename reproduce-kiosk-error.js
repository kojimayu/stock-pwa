
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTransaction() {
    try {
        console.log("Testing Kiosk Transaction with NEW REGEX...");

        // 1. Setup Mock Data
        const vendor = await prisma.vendor.findFirst();
        if (!vendor) throw new Error("No vendor found");

        const aircon = await prisma.airconProduct.findFirst();
        const baseCode = aircon ? aircon.code : "TEST-AC"; // e.g. RAS-AJ22

        // Test Case A: Standard Suffix
        const modelA = `${baseCode}N`; // Assuming N is suffix

        // Test Case B: Long Suffix (Task 74: 25S)
        const modelB = `${baseCode}25S`;

        const inputs = [
            {
                managementNo: "999999",
                customerName: "TestCustomer",
                contractor: "TestContractor",
                items: [modelA, modelA], // Duplicate items
                vendorId: vendor.id
            },
            {
                managementNo: "888888",
                customerName: "TestCustomer2",
                contractor: "TestContractor2",
                items: [modelB], // Long suffix
                vendorId: vendor.id
            }
        ];

        for (const input of inputs) {
            console.log(`Sending transaction for items: ${JSON.stringify(input.items)}`);

            // Emulate Backend Logic (Direct Prisma call to bypass Next.js Request object mock complexity)
            // Copy-paste logic from route.ts

            await prisma.$transaction(async (tx) => {
                const logs = [];
                for (const modelNumber of input.items) {
                    // New Regex logic from route.ts
                    let baseCode = modelNumber.replace(/[A-Z]$/i, '');
                    const ajMatch = modelNumber.match(/^(RAS-AJ\d{2})/);
                    if (ajMatch) {
                        baseCode = ajMatch[1];
                    }
                    console.log(`Parsing '${modelNumber}' -> BaseCode '${baseCode}'`);

                    const airconProduct = await tx.airconProduct.findFirst({
                        where: { code: baseCode }
                    });

                    console.log(`Found Product: ${airconProduct ? airconProduct.code : 'NULL'}`);

                    const log = await tx.airConditionerLog.create({
                        data: {
                            managementNo: String(input.managementNo),
                            customerName: input.customerName,
                            contractor: input.contractor,
                            modelNumber,
                            vendorId: Number(input.vendorId),
                            airconProductId: airconProduct?.id || null,
                        },
                    });
                    logs.push(log);

                    if (airconProduct && airconProduct.stock > 0) {
                        await tx.airconProduct.update({
                            where: { id: airconProduct.id },
                            data: { stock: { decrement: 1 } }
                        });
                        console.log("Stock decremented");
                    }
                }
                return logs;
            });
            console.log("Transaction Success");
        }

    } catch (e) {
        console.error("Test Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

testTransaction();
