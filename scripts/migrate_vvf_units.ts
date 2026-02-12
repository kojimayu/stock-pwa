
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TARGET_PRODUCTS = [
    { id: 62, unit: 'm', qtyPerBox: 100 }, // VVF2mm×3芯 -> 100m
    { id: 65, unit: 'm', qtyPerBox: 300 }, // IV1.6mm 白 -> 300m
];

async function main() {
    console.log("Starting VVF/IV Unit Migration...");

    // 1. Update Master Data
    for (const p of TARGET_PRODUCTS) {
        const product = await prisma.product.findUnique({ where: { id: p.id } });
        if (product) {
            await prisma.product.update({
                where: { id: p.id },
                data: { unit: p.unit, quantityPerBox: p.qtyPerBox }
            });
            console.log(`Updated Product [${product.name}] (ID: ${p.id}): unit='${p.unit}', qtyPerBox=${p.qtyPerBox}`);
        } else {
            console.warn(`Product ID ${p.id} not found.`);
        }
    }

    // 2. Update Transaction History
    const transactions = await prisma.transaction.findMany();
    let updatedCount = 0;

    for (const tx of transactions) {
        let items: any[] = [];
        try {
            items = JSON.parse(tx.items);
        } catch (e) {
            console.error(`Failed to parse transaction ${tx.id} items`);
            continue;
        }

        let hasChanges = false;
        items = items.map(item => {
            const target = TARGET_PRODUCTS.find(p => p.id === item.productId);
            if (!target) return item;

            // Detect Coil Price (High Price > 1000 JPY)
            // VVF 240/m -> ~24000/coil. IV 52/m -> ~15600/coil.
            if (item.price > 1000) {
                const oldPrice = item.price;
                const oldQty = item.quantity;

                // Conversion
                const newPrice = oldPrice / target.qtyPerBox; // Float allowed in JSON
                const newQty = oldQty * target.qtyPerBox;

                console.log(`[Tx ${tx.id}] Converting Product ${item.name} (${item.productId}): Price ${oldPrice} -> ${newPrice}, Qty ${oldQty} -> ${newQty}`);

                hasChanges = true;
                return {
                    ...item,
                    price: newPrice,
                    quantity: newQty,
                    isBox: false, // No longer a box unit
                    quantityPerBox: undefined, // Remove box info
                    unit: 'm' // Set proper unit
                };
            }

            // Just update unit label if it's missing or wrong (and price is low)
            if (item.unit !== 'm') {
                hasChanges = true;
                return { ...item, unit: 'm' };
            }

            return item;
        });

        if (hasChanges) {
            const newItemsStr = JSON.stringify(items);
            await prisma.transaction.update({
                where: { id: tx.id },
                data: { items: newItemsStr }
            });
            updatedCount++;
        }
    }

    console.log(`Migration Complete. Updated ${updatedCount} transactions.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
