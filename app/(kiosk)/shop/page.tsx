import { ShopInterface } from "@/components/kiosk/shop-interface";
import { getProducts, checkActiveInventory } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
    const products = await getProducts();
    const isInventoryActive = await checkActiveInventory();

    const serializedProducts = products.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    }));

    return <ShopInterface products={serializedProducts} isInventoryActive={isInventoryActive} />;
}
