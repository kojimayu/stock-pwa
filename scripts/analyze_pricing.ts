/**
 * カテゴリ別掛率分析 + 価格順序セーフガードチェック
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        select: {
            id: true, code: true, name: true,
            category: true, subCategory: true,
            priceA: true, priceB: true, priceC: true, cost: true,
        },
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });

    console.log(`\n=== 全 ${products.length} 商品の分析 ===\n`);

    // 1. カテゴリ別掛率分析
    const categoryMap = new Map<string, typeof products>();
    products.forEach(p => {
        const cat = p.category || '未分類';
        if (!categoryMap.has(cat)) categoryMap.set(cat, []);
        categoryMap.get(cat)!.push(p);
    });

    console.log(`### 1. カテゴリ別掛率 (priceA / cost) ###`);
    console.log(`${'カテゴリ'.padEnd(16)} | 商品数 | 掛率範囲 | 代表的掛率 | cost=0`);
    console.log('-'.repeat(80));

    for (const [cat, items] of categoryMap) {
        const withCost = items.filter(p => p.cost > 0);
        const noCost = items.filter(p => p.cost === 0);
        const rates = withCost.map(p => Math.round((p.priceA / p.cost) * 100) / 100);
        const rateSet = new Map<number, number>();
        rates.forEach(r => rateSet.set(r, (rateSet.get(r) || 0) + 1));
        const sortedRates = [...rateSet.entries()].sort((a, b) => b[1] - a[1]);
        const topRate = sortedRates.length > 0 ? sortedRates[0] : null;

        const min = rates.length > 0 ? Math.min(...rates) : '-';
        const max = rates.length > 0 ? Math.max(...rates) : '-';
        const range = min === max ? `${min}` : `${min}〜${max}`;

        console.log(
            `${cat.padEnd(16)} | ${String(items.length).padStart(4)}件 | ${String(range).padStart(10)} | ${topRate ? `${topRate[0]}(${topRate[1]}件)` : 'N/A'.padStart(10)} | ${noCost.length > 0 ? `${noCost.length}件` : '-'}`
        );
    }

    // 詳細: カテゴリごとの掛率バリエーション
    console.log(`\n### 1b. 掛率が統一されていないカテゴリの詳細 ###`);
    for (const [cat, items] of categoryMap) {
        const withCost = items.filter(p => p.cost > 0);
        const rates = withCost.map(p => Math.round((p.priceA / p.cost) * 100) / 100);
        const uniqueRates = new Set(rates);
        if (uniqueRates.size > 1) {
            console.log(`\n[${cat}] 掛率: ${[...uniqueRates].sort().join(', ')}`);
            withCost.forEach(p => {
                const rate = Math.round((p.priceA / p.cost) * 100) / 100;
                if (rate !== [...uniqueRates][0]) {
                    console.log(`  ${p.code}: priceA=${p.priceA} cost=${p.cost} 掛率=${rate}`);
                }
            });
        }
    }

    // 2. 価格セーフガードチェック: cost < priceB < priceA < priceC
    console.log(`\n\n### 2. 価格順序セーフガード: cost < priceB < priceA < priceC ###`);

    const violations: any[] = [];
    products.forEach(p => {
        const issues: string[] = [];
        if (p.cost > 0 && p.priceB > 0 && p.priceB <= p.cost) {
            issues.push(`priceB(${p.priceB}) ≤ cost(${p.cost}) → 赤字！`);
        }
        if (p.priceA > 0 && p.priceB > 0 && p.priceA <= p.priceB) {
            issues.push(`priceA(${p.priceA}) ≤ priceB(${p.priceB}) → A≤B逆転`);
        }
        // priceC=0は「未設定」として除外
        if (p.priceC > 0 && p.priceA > 0 && p.priceC <= p.priceA) {
            issues.push(`priceC(${p.priceC}) ≤ priceA(${p.priceA}) → C≤A逆転`);
        }
        if (p.cost > 0 && p.priceA > 0 && p.priceA <= p.cost) {
            issues.push(`priceA(${p.priceA}) ≤ cost(${p.cost}) → A赤字！`);
        }
        if (issues.length > 0) {
            violations.push({ code: p.code, name: p.name, category: p.category, priceA: p.priceA, priceB: p.priceB, priceC: p.priceC, cost: p.cost, issues });
        }
    });

    if (violations.length === 0) {
        console.log(`✅ 全商品で cost < priceB < priceA の順序が守られています`);
    } else {
        console.log(`⚠️ ${violations.length}件の違反あり:`);
        violations.forEach(v => {
            console.log(`\n  ${v.code} (${v.name}) [${v.category}]`);
            console.log(`    cost=${v.cost} priceB=${v.priceB} priceA=${v.priceA} priceC=${v.priceC}`);
            v.issues.forEach((i: string) => console.log(`    ❌ ${i}`));
        });
    }

    // 3. cost=0 の商品（仕入値未設定）
    const noCost = products.filter(p => p.cost === 0);
    console.log(`\n### 3. cost=0（仕入値未設定）: ${noCost.length}件 ###`);
    if (noCost.length > 0) {
        noCost.forEach(p => {
            console.log(`  ${p.code} | ${p.name} | priceA=${p.priceA} priceB=${p.priceB} | ${p.category}`);
        });
    }

    // 4. priceC=0 の商品
    const noC = products.filter(p => p.priceC === 0);
    console.log(`\n### 4. priceC=0（未設定）: ${noC.length}件 ###`);

    // 5. コードでのセーフガード有無チェック
    console.log(`\n### 5. コード上のセーフガードチェック結果 ###`);
    console.log(`→ importProducts関数やupdateProduct関数に価格順序チェックがあるか確認が必要`);

    console.log(`\n=== サマリー ===`);
    console.log(`総商品数: ${products.length}`);
    console.log(`カテゴリ数: ${categoryMap.size}`);
    console.log(`価格順序違反: ${violations.length}件`);
    console.log(`cost未設定: ${noCost.length}件`);
    console.log(`priceC未設定: ${noC.length}件`);

    await prisma.$disconnect();
}

main().catch(console.error);
