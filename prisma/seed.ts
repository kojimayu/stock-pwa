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
            users: {
                create: {
                    name: 'Test User',
                    pinCode: '1111',
                }
            }
        },
    })
    console.log(`Created vendor: ${vendor.name} (User PIN: 1111)`)

    // Create Products
    const products = await prisma.product.createMany({
        data: [
            {
                code: 'PROD-001',
                name: '商品A (Category 1)',
                category: 'Category 1',
                priceA: 100,
                priceB: 80,
                stock: 50,
                minStock: 10,
                cost: 60,
                supplier: 'Vendor X',
                color: 'White'
            },
            {
                code: 'PROD-002',
                name: '商品B (Category 1)',
                category: 'Category 1',
                priceA: 200,
                priceB: 150,
                stock: 20,
                minStock: 5,
                cost: 120,
                supplier: 'Vendor Y',
            },
            {
                code: 'PROD-003',
                name: '商品C (Category 2)',
                category: 'Category 2',
                priceA: 500,
                priceB: 400,
                stock: 0, // Out of stock
                minStock: 5,
                cost: 300,
            },
        ],
    })
    console.log(`Created ${products.count} products`)

    // Create Dummy Transactions
    const itemsJson = JSON.stringify([
        { productId: 1, quantity: 2, price: 100 },
        { productId: 2, quantity: 1, price: 200 }
    ]);

    await prisma.transaction.createMany({
        data: [
            {
                vendorId: vendor.id,
                items: itemsJson,
                totalAmount: 400,
                date: new Date(), // Now
            },
            {
                vendorId: vendor.id,
                items: JSON.stringify([{ productId: 1, quantity: 5, price: 100 }]),
                totalAmount: 500,
                date: new Date(Date.now() - 86400000), // Yesterday
            },
            {
                vendorId: vendor.id,
                items: JSON.stringify([{ productId: 2, quantity: 10, price: 200 }]),
                totalAmount: 2000,
                date: new Date(Date.now() - 172800000), // 2 days ago
            }
        ]
    })
    console.log('Created dummy transactions')


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
