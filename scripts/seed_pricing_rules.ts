/**
 * カテゴリ掛率ルールの初期データ投入 + エアコン商品をMANUALに設定
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. カテゴリ掛率ルールを作成
    const rules = [
        { category: '化粧カバー', markupRateA: 1.2, markupRateB: 1.1 },
        { category: '配管資材', markupRateA: 1.2, markupRateB: 1.1 },
        { category: '架台・ブロック', markupRateA: 1.2, markupRateB: 1.1 },
        { category: '電線・コンセント', markupRateA: 1.2, markupRateB: 1.1 },
        { category: 'エアコン', markupRateA: 1.5, markupRateB: 1.3 },
    ];

    for (const rule of rules) {
        await prisma.categoryPricingRule.upsert({
            where: { category: rule.category },
            update: { markupRateA: rule.markupRateA, markupRateB: rule.markupRateB },
            create: rule,
        });
        console.log(`✅ ${rule.category}: A×${rule.markupRateA}, B×${rule.markupRateB}`);
    }

    // 2. エアコン商品をMANUALに設定（手動価格設定のため）
    const airconUpdate = await prisma.product.updateMany({
        where: { category: 'エアコン' },
        data: { priceMode: 'MANUAL' },
    });
    console.log(`\n✅ エアコン ${airconUpdate.count}件 → MANUAL設定`);

    // 3. 確認: 各カテゴリの商品数とpriceModeの分布
    const categories = await prisma.product.groupBy({
        by: ['category', 'priceMode'],
        _count: true,
    });
    console.log('\n=== カテゴリ × priceMode 一覧 ===');
    categories.forEach(c => {
        console.log(`${c.category}: ${c.priceMode} (${c._count}件)`);
    });

    await prisma.$disconnect();
}

main().catch(console.error);
