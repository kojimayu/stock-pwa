/**
 * 部材マスターExcelとDB価格の比較スクリプト
 * 実行: npx tsx scripts/compare_prices.ts
 */
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Excel読み込み
    const wb = XLSX.readFile('0部材-ﾏｽﾀｰ 改正2026-1.xlsx');
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

    const excelItems: { name: string; price: number }[] = [];
    for (let i = 2; i < data.length; i++) {
        const r = data[i] as any[];
        if (r && r[0] && r[1]) {
            excelItems.push({ name: String(r[0]).trim(), price: Number(r[1]) });
        }
    }

    // DB読み込み
    const dbProducts = await prisma.product.findMany({
        select: { id: true, code: true, name: true, priceA: true, priceB: true, priceC: true, cost: true, category: true },
    });

    console.log(`\n=== 価格比較レポート ===`);
    console.log(`Excel: ${excelItems.length}件, DB: ${dbProducts.length}件\n`);

    // マッチング（コード or 名前で部分一致）
    const matched: any[] = [];
    const excelOnly: typeof excelItems = [];

    // 全角→半角の正規化
    const normalize = (s: string) => s
        .replace(/[Ａ-Ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .replace(/[ａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .replace(/　/g, ' ')
        .replace(/\s+/g, '')
        .toLowerCase();

    for (const e of excelItems) {
        const ne = normalize(e.name);
        const dbMatch = dbProducts.find(d => {
            const nc = normalize(d.code);
            const nn = normalize(d.name);
            return nc === ne || nn === ne || nc.includes(ne) || ne.includes(nc);
        });

        if (dbMatch) {
            const diffA = e.price - dbMatch.priceA;
            const diffB = e.price - dbMatch.priceB;
            const rateVsCost = dbMatch.cost > 0 ? Math.round((e.price / dbMatch.cost) * 100) / 100 : null;
            const ratePriceAVsCost = dbMatch.cost > 0 ? Math.round((dbMatch.priceA / dbMatch.cost) * 100) / 100 : null;
            matched.push({
                excel: e.name,
                excelPrice: e.price,
                dbCode: dbMatch.code,
                dbName: dbMatch.name,
                priceA: dbMatch.priceA,
                priceB: dbMatch.priceB,
                priceC: dbMatch.priceC,
                cost: dbMatch.cost,
                category: dbMatch.category,
                diffA,
                diffB,
                rateVsCost,
                ratePriceAVsCost,
            });
        } else {
            excelOnly.push(e);
        }
    }

    // 1. 差異あり
    const withDiff = matched.filter(m => m.diffA !== 0);
    console.log(`\n### 1. Excelとprice_Aに差異がある商品 (${withDiff.length}件) ###`);
    console.log('品名 | Excel単価 | DB_priceA | 差額 | DB_cost | Excel掛率 | DB掛率');
    console.log('-'.repeat(80));
    withDiff.forEach(m => {
        console.log(`${m.excel} | ${m.excelPrice} | ${m.priceA} | ${m.diffA > 0 ? '+' : ''}${m.diffA} | ${m.cost} | ${m.rateVsCost ?? '-'} | ${m.ratePriceAVsCost ?? '-'}`);
    });

    // 2. 一致
    const exact = matched.filter(m => m.diffA === 0);
    console.log(`\n### 2. Excelとprice_Aが一致する商品 (${exact.length}件) ###`);
    exact.forEach(m => {
        console.log(`${m.excel}: ${m.excelPrice}円 (cost=${m.cost}, 掛率=${m.rateVsCost ?? '-'})`);
    });

    // 3. Excel掛率データ（costが設定されているもの）
    const withCost = matched.filter(m => m.cost > 0);
    console.log(`\n### 3. 掛率分析 (costが設定されている ${withCost.length}件) ###`);
    console.log('品名 | Excel単価 | DB_cost | 掛率(Excel/cost) | priceA/cost');
    withCost
        .sort((a: any, b: any) => (a.rateVsCost || 0) - (b.rateVsCost || 0))
        .forEach((m: any) => {
            const flag = m.rateVsCost && m.rateVsCost < 1.0 ? '⚠赤字' : '';
            console.log(`${m.excel} | ${m.excelPrice} | ${m.cost} | ${m.rateVsCost} | ${m.ratePriceAVsCost} ${flag}`);
        });

    // 4. マッチしなかったExcelアイテム
    console.log(`\n### 4. DBに見つからないExcel商品 (${excelOnly.length}件) ###`);
    excelOnly.forEach(e => console.log(`${e.name}: ${e.price}円`));

    // 5. DBにあってExcelにない商品（DBのみ）
    const matchedDbCodes = new Set(matched.map((m: any) => m.dbCode));
    const dbOnly = dbProducts.filter(d => !matchedDbCodes.has(d.code));
    console.log(`\n### 5. Excelにない(DB_only)商品 (${dbOnly.length}件) ###`);
    dbOnly.slice(0, 30).forEach(d => console.log(`${d.code} | ${d.name} | priceA=${d.priceA} cost=${d.cost} | ${d.category}`));
    if (dbOnly.length > 30) console.log(`... 他 ${dbOnly.length - 30}件`);

    // サマリー
    console.log(`\n=== サマリー ===`);
    console.log(`Excel商品数: ${excelItems.length}`);
    console.log(`DB商品数: ${dbProducts.length}`);
    console.log(`マッチ: ${matched.length}件`);
    console.log(`  うち差異あり: ${withDiff.length}件`);
    console.log(`  うち差異なし: ${exact.length}件`);
    console.log(`Excel_only: ${excelOnly.length}件`);
    console.log(`DB_only: ${dbOnly.length}件`);

    await prisma.$disconnect();
}

main().catch(console.error);
