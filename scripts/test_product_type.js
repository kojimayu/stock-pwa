const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Testing productType field...");

    const code = "TEST_TYPE_001";

    try {
        // Clean up if exists
        await prisma.product.deleteMany({ where: { code } });

        // Create
        const created = await prisma.product.create({
            data: {
                code,
                name: "Test Type Product",
                category: "TestCat",
                subCategory: "TestSub",
                productType: "TEST_TYPE_VALUE", // This is the new field
                priceA: 100,
                priceB: 90,
                priceC: 80,
                stock: 10,
                minStock: 1,
                cost: 50,
                unit: "個"
            }
        });
        console.log("Created product:", created);

        if (created.productType === "TEST_TYPE_VALUE") {
            console.log("SUCCESS: productType was saved correctly.");
        } else {
            console.error("FAILURE: productType was NOT saved.");
        }

        // Cleanup
        await prisma.product.deleteMany({ where: { code } });

    } catch (e) {
        console.error("Error during test:", e);
    }
}

main()
    .catch(e => {
        throw e
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
