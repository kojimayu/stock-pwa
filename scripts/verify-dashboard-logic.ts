import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDashboardLogic() {
    console.log("=== ダッシュボード表示シミュレーション ===");

    // 1. 取得ロジック (admin/page.tsxと同じ)
    // 1. 最低在庫設定がある商品をすべて取得
    const candidates = await prisma.product.findMany({
        where: {
            minStock: { gt: 0 }
        },
        include: {
            // 発注済みチェック用
            orderItems: {
                where: {
                    order: {
                        status: { in: ["ORDERED", "PARTIAL"] }
                    }
                },
                select: { id: true }
            }
        },
        orderBy: [
            { stock: 'asc' },
            { name: 'asc' }
        ]
    });

    // 2. フィルタリング (在庫 < 最低在庫 かつ 発注済みなし)
    const lowStockProducts = candidates.filter(p =>
        p.stock < p.minStock && p.orderItems.length === 0
    );

    // 3. 結果表示
    // (以降の処理は lowStockProducts を使用)

    // 2. 分類ロジック
    const criticalMaterials = lowStockProducts.filter(p => p.stock === 0);
    const warningMaterials = lowStockProducts.filter(p => p.stock > 0);

    // 3. 結果表示
    console.log(`\n■ [赤] 発注必要（在庫切れ: 0個）: ${criticalMaterials.length}件`);
    if (criticalMaterials.length > 0) {
        criticalMaterials.forEach(p => {
            console.log(`- [${p.code}] ${p.name} (在庫:${p.stock}, 最低:${p.minStock})`);
        });
    } else {
        console.log("なし");
    }

    console.log(`\n■ [黄] 在庫注意（最低在庫未満: Stock < Min）: ${warningMaterials.length}件`);
    if (warningMaterials.length > 0) {
        warningMaterials.forEach(p => {
            console.log(`- [${p.code}] ${p.name} (在庫:${p.stock}, 最低:${p.minStock})`);
        });
    } else {
        console.log("なし");
    }

    console.log("\n---------------------------------------------------");
    console.log("判定ロジック確認:");
    console.log("- Stock === 0            -> 赤（アラート）");
    console.log("- 0 < Stock < MinStock   -> 黄（注意）");
    console.log("- Stock === MinStock     -> 対象外（表示なし）");
    console.log("---------------------------------------------------");
}

checkDashboardLogic()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
