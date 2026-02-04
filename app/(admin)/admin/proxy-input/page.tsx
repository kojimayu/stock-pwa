import { getProducts, getVendors } from "@/lib/actions";
import { ProxyInputClient } from "./proxy-input-client";

export default async function ProxyInputPage() {
    const [products, vendors] = await Promise.all([
        getProducts(),
        getVendors(),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">代理入力</h2>
                <p className="text-muted-foreground">業者に代わって材料の持出しを記録します</p>
            </div>
            <ProxyInputClient products={products} vendors={vendors} />
        </div>
    );
}
