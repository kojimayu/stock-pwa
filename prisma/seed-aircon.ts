import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding database...");

    // エアコン年度サフィックス設定
    await prisma.systemSetting.upsert({
        where: { key: "aircon_year_suffix" },
        update: { value: "N" },
        create: { key: "aircon_year_suffix", value: "N" },
    });

    // エアコン主要4品目
    const airconProducts = [
        { code: "RAS-AJ22", name: "日立エアコン AJ 2.2kW", capacity: "2.2kW" },
        { code: "RAS-AJ25", name: "日立エアコン AJ 2.5kW", capacity: "2.5kW" },
        { code: "RAS-AJ28", name: "日立エアコン AJ 2.8kW", capacity: "2.8kW" },
        { code: "RAS-AJ36", name: "日立エアコン AJ 3.6kW", capacity: "3.6kW" },
    ];

    for (const product of airconProducts) {
        await prisma.airconProduct.upsert({
            where: { code: product.code },
            update: { name: product.name, capacity: product.capacity },
            create: {
                code: product.code,
                name: product.name,
                capacity: product.capacity,
                stock: 0,
                minStock: 2, // デフォルト最低在庫2台
            },
        });
        console.log(`  Created/Updated: ${product.code}`);
    }

    console.log("Seeding completed!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
