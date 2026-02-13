import { getProducts, getVendors } from "@/lib/actions";
import { ProxyInputClient } from "./proxy-input-client";

export default async function ProxyInputPage() {
    const [products, vendors] = await Promise.all([
        getProducts(),
        getVendors(),
    ]);

    // ProxyInputClientが全画面表示を管理するため、ラッパーのみ提供
    const serializedProducts = products.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    }));

    return <ProxyInputClient products={serializedProducts} vendors={vendors} />;
}
