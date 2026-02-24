/**
 * 材料⇔エアコン紐づけ + 在庫同期スクリプト
 * 実行: npx tsx scripts/link_aircon_products.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 材料コード → エアコンコードのマッピング
const MAPPING: Record<string, string> = {
    'RSAJ22': 'RAS-AJ22',
    'RSAJ25': 'RAS-AJ25',
    'RSAJ28': 'RAS-AJ28',
    'RSAJ36': 'RAS-AJ36',
};

async function main() {
    console.log('=== 材料⇔エアコン紐づけ + 在庫同期 ===\n');

    for (const [materialCode, airconCode] of Object.entries(MAPPING)) {
        const product = await prisma.product.findUnique({ where: { code: materialCode } });
        const aircon = await prisma.airconProduct.findUnique({ where: { code: airconCode } });

        if (!product) {
            console.log(`❌ 材料 ${materialCode} が見つかりません`);
            continue;
        }
        if (!aircon) {
            console.log(`❌ エアコン ${airconCode} が見つかりません`);
            continue;
        }

        console.log(`${materialCode} (材料在庫: ${product.stock}) → ${airconCode} (エアコン在庫: ${aircon.stock})`);

        // 紐づけ + 在庫同期
        await prisma.product.update({
            where: { id: product.id },
            data: {
                airconProductId: aircon.id,
                stock: aircon.stock, // エアコン在庫に合わせる
            },
        });

        console.log(`  ✅ 紐づけ完了 (airconProductId: ${aircon.id}) / 在庫同期: ${product.stock} → ${aircon.stock}`);
    }

    console.log('\n完了');
    await prisma.$disconnect();
}

main();
