// 管理者ユーザーの初期設定スクリプト
// 使い方: node scripts/seed-admin-users.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// 初期パスワード
const INITIAL_PASSWORD = 'plus2025';

// 管理者アカウント一覧
const ADMIN_USERS = [
    { email: 't.mizutani@plus-company.co.jp', name: '水谷 天真' },
    { email: 'm.fukumoto@plus-company.co.jp', name: '福本' },
    { email: 'y.kojima@plus-company.co.jp', name: '小島雄一郎' },
    { email: 'h.tada@plus-company.co.jp', name: '多田' },
    { email: 'h.takahashi@plus-company.co.jp', name: '高橋' },
];

async function main() {
    console.log('管理者アカウントをリセットします...\n');

    const hashedPassword = await bcrypt.hash(INITIAL_PASSWORD, 12);

    for (const user of ADMIN_USERS) {
        try {
            const result = await prisma.adminUser.upsert({
                where: { email: user.email },
                update: {
                    name: user.name,
                    password: hashedPassword,           // パスワードをリセット
                    mustChangePassword: true,           // パスワード変更を再度必須に
                },
                create: {
                    email: user.email,
                    name: user.name,
                    password: hashedPassword,
                    mustChangePassword: true,
                },
            });
            console.log(`✓ ${user.name} (${user.email}) - リセット完了`);
        } catch (error) {
            console.error(`✗ ${user.email}: ${error.message}`);
        }
    }

    console.log('\n完了しました。');
    console.log(`初期パスワード: ${INITIAL_PASSWORD}`);
    console.log('※ 初回ログイン時にパスワード変更が必要です');
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e);
        prisma.$disconnect();
        process.exit(1);
    });
