import { getProducts } from "@/lib/actions";
import { ProductList } from "@/components/admin/product-list";

export default async function ProductsPage() {
    const products = await getProducts();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">商品管理</h2>
                <p className="text-muted-foreground">出庫対象の商品・在庫の管理</p>
            </div>

            <ProductList products={products} />
        </div>
    );
}
