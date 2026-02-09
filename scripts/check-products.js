const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: 'IV' } },
        { name: { contains: 'ビニール' } },
        { name: { contains: 'テープ' } }
      ]
    }
  });

  console.log("--- Found Products ---");
  products.forEach(p => {
    console.log(`ID: ${p.id}, Name: ${p.name}, Stock: ${p.stock}, Unit: ${p.unit}, QtyPerBox: ${p.quantityPerBox}, PriceA: ${p.priceA}, PriceBox: ${p.pricePerBox}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
