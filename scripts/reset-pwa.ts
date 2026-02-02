import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const askQuestion = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(query, resolve));
};

const args = process.argv.slice(2);
const force = args.includes('--yes') || args.includes('-y');
const resetStockArg = args.includes('--reset-stock');

async function main() {
    console.log("\n=== Stock PWA データリセットツール ===");
    console.log("以下の履歴データを完全に削除します:");
    console.log(" - 取引履歴 (Transaction)");
    console.log(" - 在庫ログ (InventoryLog, AirConditionerLog, OperationLog)");
    console.log(" - エアコン発注データ (AirconOrder, AirconOrderItem)");
    console.log(" - 棚卸データ (InventoryCount, InventoryCountItem)");
    console.log("\n※ 商品マスタ、業者マスタ、システム設定は残ります。");

    if (!force) {
        const confirm = await askQuestion("\n実行してよろしいですか？ (yes/no): ");
        if (confirm.toLowerCase() !== 'yes') {
            console.log("キャンセルしました。");
            return;
        }
    } else {
        console.log("強制実行モード: 確認をスキップします。");
    }

    let shouldResetStock = false;
    if (resetStockArg) {
        shouldResetStock = true;
    } else if (!force) {
        const resetStock = await askQuestion("現在の在庫数をすべて 0 にリセットしますか？ (yes/no): ");
        shouldResetStock = resetStock.toLowerCase() === 'yes';
    } else {
        console.log("※在庫リセットフラグがないため、在庫数は保持します。");
    }

    console.log("\n履歴データを削除中...");

    // Delete history (Order matters for foreign keys if no cascade)
    // Delete children first
    await prisma.transaction.deleteMany(); // No children in other tables?
    await prisma.inventoryLog.deleteMany();
    await prisma.airConditionerLog.deleteMany();

    await prisma.airconOrderItem.deleteMany();
    await prisma.airconOrder.deleteMany();

    await prisma.inventoryCountItem.deleteMany();
    await prisma.inventoryCount.deleteMany();

    await prisma.operationLog.deleteMany();

    // Reset ID sequences (SQLite specific)
    try {
        const tables = [
            'Transaction', 'InventoryLog', 'AirConditionerLog',
            'AirconOrder', 'AirconOrderItem',
            'InventoryCount', 'InventoryCountItem', 'OperationLog'
        ];
        // Use executeRawUnsafe for SQLite sequence reset
        for (const table of tables) {
            await prisma.$executeRawUnsafe(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
        }
    } catch (e) {
        // Ignore errors (table might not exist in sequence table if no inserts happened)
    }

    if (shouldResetStock) {
        console.log("在庫数をリセット中...");
        await prisma.product.updateMany({ data: { stock: 0 } });
        await prisma.airconProduct.updateMany({ data: { stock: 0 } });
        console.log(" - 一般部材、エアコンの在庫を 0 にしました。");
    } else {
        console.log("在庫数は現在のまま保持されます。");
    }

    console.log("\n完了しました。");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        rl.close();
    });
