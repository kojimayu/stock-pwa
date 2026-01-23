import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding data...')

    // Clean up existing data
    await prisma.transaction.deleteMany()
    await prisma.product.deleteMany()
    await prisma.vendor.deleteMany()

    // Create Vendor
    const vendor = await prisma.vendor.create({
        data: {
            name: 'Test Vendor',
            pinCode: '1111',
        },
    })
    console.log(`Created vendor: ${vendor.name} (PIN: ${vendor.pinCode})`)

    // Create Products
    const products = await prisma.product.createMany({
        data: [
            {
                name: '商品A (Category 1)',
                category: 'Category 1',
                priceA: 100,
                priceB: 80,
                stock: 50,
                minStock: 10,
            },
            {
                name: '商品B (Category 1)',
                category: 'Category 1',
                priceA: 200,
                priceB: 150,
                stock: 20,
                minStock: 5,
            },
            {
                name: '商品C (Category 2)',
                category: 'Category 2',
                priceA: 500,
                priceB: 400,
                stock: 0, // Out of stock
                minStock: 5,
            },
        ],
    })
    console.log(`Created ${products.count} products`)

    console.log('Seeding finished.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
