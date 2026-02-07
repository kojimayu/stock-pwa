
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting migration: Adding product codes to transactions...");

    try {
        // 1. 全ての商品を取得してマップ化 (ID -> Code)
        const products = await prisma.product.findMany({
            select: { id: true, code: true },
        });
        const productMap = new Map<number, string>();
        products.forEach((p) => {
            productMap.set(p.id, p.code);
        });
        console.log(`Loaded ${products.length} products.`);

        // 2. 全ての取引を取得
        const transactions = await prisma.transaction.findMany();
        console.log(`Found ${transactions.length} transactions.`);

        let updatedCount = 0;

        for (const tx of transactions) {
            let items: any[] = [];
            try {
                items = JSON.parse(tx.items);
            } catch (e) {
                console.error(`Failed to parse items for transaction #${tx.id}`, e);
                continue;
            }

            let hasChanges = false;
            const newItems = items.map((item: any) => {
                // マニュアル入力アイテムはスキップ
                if (item.isManual) return item;

                // 既にコードがある場合はスキップ
                if (item.code) return item;

                // 商品IDからコードを取得
                const code = productMap.get(item.productId);
                if (code) {
                    hasChanges = true;
                    return { ...item, code };
                } else {
                    // 商品が見つからない場合（削除済みなど）
                    console.warn(`Product not found for ID: ${item.productId} in Transaction #${tx.id}`);
                    return item;
                }
            });

            if (hasChanges) {
                await prisma.transaction.update({
                    where: { id: tx.id },
                    data: { items: JSON.stringify(newItems) },
                });
                updatedCount++;
                if (updatedCount % 10 === 0) process.stdout.write(".");
            }
        }

        console.log(`\nMigration completed. Updated ${updatedCount} transactions.`);
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
