
import { getVendorAirconStock } from './actions';
import { prisma } from './prisma';

async function main() {
    try {
        const stock = await getVendorAirconStock();
        console.log(JSON.stringify(stock, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
