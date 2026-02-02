"use client";

import { useState, useMemo, useEffect } from "react";
import { CategoryTabs } from "./category-tabs";
import { VerticalCategoryList } from "./vertical-category-list";
import { VerticalSubCategoryList } from "./vertical-sub-category-list";
import { ProductListItem } from "./product-list-item";
import { ManualProductSheet } from "@/components/kiosk/manual-product-sheet";
import { CartSummary } from "./cart-summary";
import { LogOut, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

interface Product {
    id: number;
    name: string;
    category: string;
    subCategory?: string | null;
    priceA: number;
    priceB: number;
    stock: number;
    minStock: number;
    createdAt: string;
    updatedAt: string;
}

interface ShopInterfaceProps {
    products: Product[];
    isInventoryActive: boolean;
}

export function ShopInterface({ products, isInventoryActive }: ShopInterfaceProps) {
    const [selectedCategory, setSelectedCategory] = useState("すべて");
    const [selectedSubCategory, setSelectedSubCategory] = useState("すべて");
    const router = useRouter();
    const clearCart = useCartStore((state) => state.clearCart);
    const vendor = useCartStore((state) => state.vendor);

    // Reset SubCategory when Category changes
    useEffect(() => {
        setSelectedSubCategory("すべて");
    }, [selectedCategory]);

    const categories = useMemo(() => {
        const cats = new Set(products.map((p) => p.category));
        return Array.from(cats).sort();
    }, [products]);

    const subCategories = useMemo(() => {
        if (selectedCategory === "すべて") return [];
        const subs = new Set(
            products
                .filter((p) => p.category === selectedCategory && p.subCategory)
                .map((p) => p.subCategory!)
        );
        return Array.from(subs).sort();
    }, [products, selectedCategory]);

    const filteredProducts = useMemo(() => {
        // First, apply category filter
        let res = products;
        if (selectedCategory !== "すべて") {
            res = res.filter((p) => p.category === selectedCategory);

            // Then apply subcategory filter
            if (selectedSubCategory !== "すべて") {
                res = res.filter((p) => p.subCategory === selectedSubCategory);
            }
        }
        return res;
    }, [products, selectedCategory, selectedSubCategory]);

    const handleLogout = () => {
        if (confirm("ログアウトしますか？カートの中身は破棄されます。")) {
            clearCart();
            router.push("/");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Inventory Warning Banner */}
            {isInventoryActive && (
                <div className="bg-red-600 text-white p-4 text-center font-bold sticky top-0 z-50 shadow-lg animate-pulse">
                    ⚠️ 現在棚卸作業中のため、入出庫は停止しています
                </div>
            )}

            {/* Header */}
            <header className="bg-slate-900 text-white p-3 sticky top-0 z-40 flex justify-between items-center shadow-md shrink-0">
                <div>
                    <h1 className="text-lg font-bold">商品選択</h1>
                    <p className="text-[10px] text-slate-300">
                        {vendor ? `${vendor.name} 様` : "未ログイン"}
                    </p>
                </div>
                <div className="flex items-center space-x-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-300 hover:text-white hover:bg-slate-800"
                        onClick={() => router.push("/shop/history")}
                    >
                        履歴
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-300 hover:text-white hover:bg-slate-800"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-4 h-4 mr-1" />
                        ログアウト
                    </Button>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* 
                   ===============================================
                   COLUMN 1: Main Category Sidebar (Desktop Only)
                   ===============================================
                */}
                <aside className="hidden md:flex flex-col w-56 bg-white border-r h-[calc(100vh-60px)] sticky top-[60px]">
                    <div className="p-3 border-b text-xs font-bold text-slate-400 bg-slate-50">カテゴリー</div>
                    <div className="flex-1 overflow-y-auto">
                        <VerticalCategoryList
                            categories={categories}
                            selectedCategory={selectedCategory}
                            onSelectCategory={setSelectedCategory}
                        />
                    </div>
                    {/* Manual Input Trigger (Sidebar Footer) */}
                    <div className="p-3 pb-8 border-t bg-slate-50">
                        <ManualProductSheet trigger={
                            <Button className="w-full h-14 bg-slate-800 text-white hover:bg-slate-700 font-bold text-base shadow-md" size="lg">
                                <Plus className="w-5 h-5 mr-2" />
                                手入力商品を追加
                            </Button>
                        } />
                    </div>
                </aside>

                {/* 
                   ===============================================
                   COLUMN 2: Sub Category Sidebar (Desktop Only)
                   ===============================================
                */}
                <aside className="hidden md:flex flex-col w-56 bg-slate-50 border-r h-[calc(100vh-60px)] sticky top-[60px]">
                    <div className="p-3 border-b text-xs font-bold text-slate-400">サブカテゴリー</div>
                    <div className="flex-1 overflow-y-auto">
                        <VerticalSubCategoryList
                            subCategories={subCategories}
                            selectedSubCategory={selectedSubCategory}
                            onSelectSubCategory={setSelectedSubCategory}
                        />
                    </div>
                </aside>

                {/* 
                   ===============================================
                   COLUMN 3: Product List (Main Content)
                   ===============================================
                */}
                <main className={`flex-1 flex flex-col min-w-0 ${isInventoryActive ? 'opacity-50 pointer-events-none grayscale' : ''}`}>

                    {/* Sticky Filters Area (Mobile Only: Category Tabs + SubCategory) */}
                    <div className="md:hidden sticky top-0 z-30 bg-slate-50 border-b shadow-sm">
                        <div className="overflow-x-auto">
                            <CategoryTabs
                                categories={categories}
                                selectedCategory={selectedCategory}
                                onSelectCategory={setSelectedCategory}
                            />
                        </div>

                        {subCategories.length > 0 && (
                            <div className="flex overflow-x-auto px-2 py-2 gap-2 bg-white border-t border-slate-100 no-scrollbar items-center">
                                <span className="text-xs text-slate-400 pl-2 whitespace-nowrap hidden sm:inline">絞り込み:</span>
                                <button
                                    onClick={() => setSelectedSubCategory("すべて")}
                                    className={`
                                        whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors border shadow-sm
                                        ${selectedSubCategory === "すべて"
                                            ? "bg-slate-800 text-white border-slate-800"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}
                                    `}
                                >
                                    すべて
                                </button>
                                {subCategories.map((sub) => (
                                    <button
                                        key={sub}
                                        onClick={() => setSelectedSubCategory(sub)}
                                        className={`
                                            whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors border shadow-sm
                                            ${selectedSubCategory === sub
                                                ? "bg-slate-800 text-white border-slate-800"
                                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}
                                        `}
                                    >
                                        {sub}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product List Content */}
                    <div className="pb-32 bg-white min-h-full">
                        {/* Manual Input Row (Mobile Only) */}
                        <div className="md:hidden">
                            <ManualProductSheet trigger={
                                <div className="p-4 border-b bg-slate-50 hover:bg-slate-100 cursor-pointer flex items-center gap-4 text-slate-600 transition-colors group">
                                    <div className="w-12 h-12 rounded-full bg-white border border-dashed border-slate-300 flex items-center justify-center group-hover:border-slate-500 group-hover:bg-slate-50">
                                        <Plus className="w-6 h-6 text-slate-400 group-hover:text-slate-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold">手入力で追加する</div>
                                        <div className="text-xs text-slate-400">一覧にない商品はこちらから登録</div>
                                    </div>
                                </div>
                            } />
                        </div>

                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-20 text-slate-500">
                                {selectedCategory === "すべて" ? "カテゴリーを選択してください" : "該当する商品はありません"}
                            </div>
                        ) : (
                            filteredProducts.map((product) => (
                                <ProductListItem key={product.id} product={product} />
                            ))
                        )}
                    </div>
                </main>
            </div>

            {/* Footer Cart Summary */}
            <CartSummary />
        </div>
    );
}
