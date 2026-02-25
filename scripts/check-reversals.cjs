const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
    datasources: { db: { url: 'file:F:/Antigravity/stock-pwa/dev.db' } }
});

(async () => {
    // TNN長澤の全取引を取得
    const txs = await p.$queryRaw`
        SELECT t.id, t.date, t.items, t.totalAmount, t.isReturned, t.returnedAt, t.lastModifiedAt,
               v.name as vendorName, vu.name as userName
        FROM "Transaction" t
        JOIN Vendor v ON t.vendorId = v.id
        LEFT JOIN VendorUser vu ON t.vendorUserId = vu.id
        WHERE v.name LIKE '%TNN%' OR v.name LIKE '%長澤%'
        ORDER BY t.date DESC
        LIMIT 20
    `;

    console.log('=== TNN長澤 全取引 ===\n');
    txs.forEach(t => {
        const jstDate = new Date(t.date);
        jstDate.setHours(jstDate.getHours() + 9);
        console.log('---');
        console.log('ID:', t.id, '| 日時:', jstDate.toISOString().replace('T', ' ').substring(0, 19), '(JST)');
        console.log('担当:', t.userName, '| 金額:', t.totalAmount, '| 戻し:', t.isReturned ? 'YES (' + t.returnedAt + ')' : 'NO');
        try {
            const items = JSON.parse(t.items);
            items.forEach(i => console.log('  ', i.name, 'x' + i.quantity));
        } catch {
            console.log('  items:', t.items);
        }
    });

    await p.$disconnect();
})();
