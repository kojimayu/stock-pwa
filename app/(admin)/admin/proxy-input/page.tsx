import { getProducts, getVendors } from "@/lib/actions";
import { ProxyInputClient } from "./proxy-input-client";

export default async function ProxyInputPage() {
    const [products, vendors] = await Promise.all([
        getProducts(),
        getVendors(),
    ]);

    // ProxyInputClientが全画面表示を管理するため、ラッパーのみ提供
    return <ProxyInputClient products={products} vendors={vendors} />;
}
