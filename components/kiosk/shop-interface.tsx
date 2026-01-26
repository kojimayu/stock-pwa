"use client";

import { useState, useMemo } from "react";
import { CategoryTabs } from "./category-tabs";
import { ProductCard } from "./product-card";
import { CartSummary } from "./cart-summary";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

interface Product {
    id: number;
    name: string;
    category: string;
    priceA: number;
    priceB: number;
    stock: number;
    minStock: number;
    createdAt: string;
    updatedAt: string;
}

interface ShopInterfaceProps {
    products: Product[];
}

export function ShopInterface({ products }: ShopInterfaceProps) {
    const [selectedCategory, setSelectedCategory] = useState("すべて");
    const router = useRouter();
    const clearCart = useCartStore((state) => state.clearCart);
    const vendor = useCartStore((state) => state.vendor);

    const categories = useMemo(() => {
        const cats = new Set(products.map((p) => p.category));
        return Array.from(cats).sort();
    }, [products]);

    const filteredProducts = useMemo(() => {
        if (selectedCategory === "すべて") {
            return products;
        }
        return products.filter((p) => p.category === selectedCategory);
    }, [products, selectedCategory]);

    const handleLogout = () => {
        // confirm dialog?
        if (confirm("ログアウトしますか？カートの中身は破棄されます。")) {
            clearCart();
            router.push("/");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            {/* Header */}
            <header className="bg-slate-900 text-white p-4 sticky top-0 z-20 flex justify-between items-center shadow-md">
                <div>
                    <h1 className="text-xl font-bold">商品選択</h1>
                    <p className="text-xs text-slate-300">
                        {vendor ? `${vendor.name} 様` : "未ログイン"}
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="ghost"
                        className="text-white hover:text-slate-200 hover:bg-slate-800"
                        onClick={() => router.push("/shop/history")}
                    >
                        履歴
                    </Button>
                    <Button
                        variant="ghost"
                        className="text-white hover:text-slate-200 hover:bg-slate-800"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-5 h-5 mr-2" />
                        ログアウト
                    </Button>
                </div>
            </header>

            {/* Categories */}
            <div className="sticky top-[72px] z-10">
                <CategoryTabs
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                />
            </div>

            {/* Product Grid */}
            <main className="p-4">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        該当する商品はありません
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredProducts.map((product) => (
                            <div key={product.id} className="h-full">
                                <ProductCard product={product} />
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Footer Cart Summary */}
            <CartSummary />
        </div>
    );
}
