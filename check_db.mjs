import { PrismaClient } from '@prisma/client';

// 接続先DB安全チェック
const dbUrl = process.env.DATABASE_URL || '(unset - using .env)';
const isTestDb = dbUrl.includes('test-vitest') || dbUrl.includes('test.db');
console.log(`\n📁 接続先DB: ${dbUrl}`);
if (isTestDb) {
    console.log('\x1b[31m⚠️  WARNING: テストDBに接続しています！本番データではありません！\x1b[0m');
    console.log('\x1b[31m   → Remove-Item Env:DATABASE_URL でリセットしてください\x1b[0m\n');
}

const prisma = new PrismaClient();
const users = await prisma.adminUser.findMany({ select: { id: true, email: true, name: true } });
console.log('AdminUser:', JSON.stringify(users, null, 2));
const vendors = await prisma.vendor.count();
console.log('Vendor count:', vendors);
const products = await prisma.product.count();
console.log('Product count:', products);
const aircon = await prisma.airconProduct.count();
console.log('AirconProduct count:', aircon);
await prisma.$disconnect();
