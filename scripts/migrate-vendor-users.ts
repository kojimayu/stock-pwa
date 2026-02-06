// 既存データ削除とVendorUser移行スクリプト
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🗑️ 取引履歴を削除中...');
    await prisma.transaction.deleteMany({});
    console.log('✅ 取引履歴削除完了');

    console.log('🗑️ エアコンログを削除中...');
    await prisma.airConditionerLog.deleteMany({});
    console.log('✅ エアコンログ削除完了');

    console.log('👤 既存VendorからVendorUserを作成中...');

    // 全てのVendorを取得
    const vendors = await prisma.vendor.findMany();

    for (const vendor of vendors) {
        // VendorUserが既に存在するかチェック
        const existingUser = await prisma.vendorUser.findFirst({
            where: { vendorId: vendor.id }
        });

        if (!existingUser) {
            await prisma.vendorUser.create({
                data: {
                    name: '代表',
                    pinCode: '1234',  // デフォルトPIN
                    pinChanged: false,
                    vendorId: vendor.id
                }
            });
            console.log(`  → ${vendor.name} に「代表」担当者を作成`);
        }
    }

    console.log('✅ VendorUser移行完了');
    console.log('🎉 全ての移行が完了しました！');
}

main()
    .catch((e) => {
        console.error('❌ エラー:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
