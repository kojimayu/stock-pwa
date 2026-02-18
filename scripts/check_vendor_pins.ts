
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./test.db' } },
});

async function main() {
    console.log('Inspecting Vendor Users and Visibility...');

    const vendors = await prisma.vendor.findMany({
        include: {
            users: true
        }
    });

    console.log(`Total Vendors: ${vendors.length}`);

    // Check active status and pinCodes
    vendors.forEach(v => {
        // Assuming there is an isActive field based on FEEDBACK.md mention "業者有効/無効チェックボックス"
        // But let's check if it exists in schema first. 
        // Based on previous logs, I didn't see isActive in the output.

        const userSummary = v.users.map(u => {
            return `${u.name} (PIN: ${u.pinCode ? 'SET' : 'NULL'})`;
        }).join(', ');

        console.log(`Vendor: ${v.name} (ID: ${v.id}) | Users: ${userSummary}`);
    });

    // Specific check for Test vendors or active flags
    // If isActive doesn't exist, maybe it's a different mechanism?
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
