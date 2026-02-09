const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: 'IV' } },
        { name: { contains: 'ビニール' } },
        { name: { contains: 'テープ' } },
        { name: { contains: '1.6' } }, // Common wire size
        { name: { contains: '2.0' } }, // Common wire size
        { category: { contains: '電線' } }
      ]
    }
  });

  console.log(`--- Found ${products.length} Products ---`);
  products.forEach(p => {
    console.log(`[${p.id}] ${p.name}`);
    console.log(`  Code: ${p.code}`);
    console.log(`  Category: ${p.category} > ${p.subCategory}`);
    console.log(`  Unit: ${p.unit}`);
    console.log(`  Stock: ${p.stock}`);
    console.log(`  QtyPerBox: ${p.quantityPerBox}`);
    console.log(`  PriceA: ${p.priceA}`);
    console.log(`  PricePerBox: ${p.pricePerBox}`);
    console.log('-----------------------------------');
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
