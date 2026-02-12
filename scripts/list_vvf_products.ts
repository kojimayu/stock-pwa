
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: "VVF" } },
                { name: { contains: "IV" } },
                { category: { contains: "電線" } },
                { subCategory: { contains: "VVF" } },
            ]
        },
        select: {
            id: true,
            code: true,
            name: true,
            category: true,
            subCategory: true,
            priceA: true,
            stock: true,
            quantityPerBox: true,
        }
    });

    console.log("Found products:", products.length);
    products.forEach(p => {
        console.log(`[${p.id}] ${p.name} (${p.category}/${p.subCategory}) Price: ${p.priceA}, Stock: ${p.stock}, QtyPerBox: ${p.quantityPerBox}`);
    });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
