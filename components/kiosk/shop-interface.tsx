"use client";

import { useState, useMemo, useEffect } from "react";
import { CategoryTabs } from "./category-tabs";
import { VerticalCategoryList } from "./vertical-category-list";
import { VerticalSubCategoryList } from "./vertical-sub-category-list";
import { ProductListItem } from "./product-list-item";
import { ManualProductSheet } from "@/components/kiosk/manual-product-sheet";
import { CartSummary } from "./cart-summary";
import { LogOut, Plus, ChevronLeft, Search, X, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

// Add Web Speech API types
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

interface Product {
    id: number;
    code?: string;
    name: string;
    category: string;
    subCategory?: string | null;
    priceA: number;
    priceB: number;
    stock: number;
    minStock: number;
    createdAt: string;
    updatedAt: string;
    productType?: string | null;
    quantityPerBox?: number;
    pricePerBox?: number;
    manufacturer?: string | null;
}

interface ShopInterfaceProps {
    products: Product[];
    isInventoryActive: boolean;
    // 代理入力モード用
    proxyMode?: boolean;
    vendorOverride?: { id: number; name: string } | null;
    onProxyExit?: () => void;
}

export function ShopInterface({
    products,
    isInventoryActive,
    proxyMode = false,
    vendorOverride,
    onProxyExit
}: ShopInterfaceProps) {
    const [selectedCategory, setSelectedCategory] = useState("すべて");
    const [selectedSubCategory, setSelectedSubCategory] = useState("すべて");
    const [selectedProductType, setSelectedProductType] = useState("すべて"); // New: Small Category
    const [searchQuery, setSearchQuery] = useState(""); // New: Search
    const [isListening, setIsListening] = useState(false);

    const router = useRouter();
    const clearCart = useCartStore((state) => state.clearCart);
    const setVendor = useCartStore((state) => state.setVendor);
    const setProxyMode = useCartStore((state) => state.setProxyMode);
    const storeVendor = useCartStore((state) => state.vendor);

    // 代理入力モードではvendorOverrideを使用
    const vendor = proxyMode ? vendorOverride : storeVendor;

    // 代理入力モードの場合、vendorをストアに設定（CheckoutButton用）
    useEffect(() => {
        if (proxyMode && vendorOverride) {
            setVendor(vendorOverride);
            setProxyMode(true);
        }
        return () => {
            if (proxyMode) {
                setProxyMode(false);
            }
        };
    }, [proxyMode, vendorOverride, setVendor, setProxyMode]);

    // Voice Search Handler
    const handleVoiceSearch = () => {
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        if (!webkitSpeechRecognition && !SpeechRecognition) {
            alert("お使いのブラウザは音声入力に対応していません。");
            return;
        }

        const Recognition = SpeechRecognition || webkitSpeechRecognition;
        const recognition = new Recognition();

        recognition.lang = 'ja-JP';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setSearchQuery(transcript);
        };

        recognition.start();
    };

    // Reset Filters when parent filter changes
    useEffect(() => {
        setSelectedSubCategory("すべて");
    }, [selectedCategory]);

    useEffect(() => {
        setSelectedProductType("すべて");
    }, [selectedCategory, selectedSubCategory]);

    // Clear search when category changes? No, user might want to search anytime.
    // Clear filters when search starts?
    useEffect(() => {
        if (searchQuery) {
            // Optional: reset categories to show we are in search mode?
            // keeping them as is might be confusing if UI shows "Aircon" but search shows "Cable".
            // For now, let's leave them, but the list will be overridden.
        }
    }, [searchQuery]);


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

    // New: Product Types (Small Category)
    const productTypes = useMemo(() => {
        // Show product types only if SubCategory is selected (or Category if needed, but per plan "Under SubCategory")
        // Plan says: "After selecting SubCategory, place filter chips"
        if (selectedCategory === "すべて") return [];

        let targetProducts = products.filter(p => p.category === selectedCategory);
        if (selectedSubCategory !== "すべて") {
            targetProducts = targetProducts.filter(p => p.subCategory === selectedSubCategory);
        }

        const types = new Set(
            targetProducts
                .filter(p => p.productType)
                .map(p => p.productType!)
        );
        return Array.from(types).sort();
    }, [products, selectedCategory, selectedSubCategory]);


    const filteredProducts = useMemo(() => {
        // 1. Search Mode Override
        if (searchQuery.trim().length > 0) {
            const lowerQ = searchQuery.toLowerCase();
            return products.filter(p =>
                p.name.toLowerCase().includes(lowerQ) ||
                (p.code && p.code.toLowerCase().includes(lowerQ))
            );
        }

        // 2. Normal Category Filtering
        let res = products;
        if (selectedCategory !== "すべて") {
            res = res.filter((p) => p.category === selectedCategory);
            if (selectedSubCategory !== "すべて") {
                res = res.filter((p) => p.subCategory === selectedSubCategory);
            }
            // 3. Product Type Filtering
            if (selectedProductType !== "すべて") {
                res = res.filter((p) => p.productType === selectedProductType);
            }
        }
        return res;
    }, [products, selectedCategory, selectedSubCategory, selectedProductType, searchQuery]);

    const handleLogout = () => {
        if (proxyMode) {
            if (confirm("代理入力を終了しますか？カートの中身は破棄されます。")) {
                clearCart();
                onProxyExit?.();
            }
        } else {
            if (confirm("ログアウトしますか？カートの中身は破棄されます。")) {
                clearCart();
                router.push("/");
            }
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
            <header className="bg-slate-900 text-white p-3 fixed top-0 left-0 right-0 z-40 flex justify-between items-center shadow-md h-[60px]">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-300 hover:text-white hover:bg-slate-800 h-10 px-3"
                    onClick={() => router.push("/mode-select")}
                >
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    戻る
                </Button>
                <div className="flex-1 max-w-xl mx-4 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="search"
                        placeholder="商品名や品番で検索..."
                        className="w-full h-10 pl-9 pr-16 rounded-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="p-1 text-slate-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={handleVoiceSearch}
                            className={`p-1.5 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            title="音声で検索"
                        >
                            <Mic className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="mr-2 hidden lg:block text-sm text-slate-300">
                    {vendor ? `${vendor.name} 様` : ""}
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

            {/* Spacer for fixed header */}
            <div className="h-[60px] shrink-0" />

            {/* Main Layout */}
            <div className="flex-1 flex flex-row relative">
                {/* 
                   ===============================================
                   COLUMN 1: Main Category Sidebar (Desktop Only)
                   Fixed position to prevent scrolling with content
                   ===============================================
                */}
                <aside className="hidden md:flex flex-col w-56 bg-white border-r fixed left-0 top-[60px] bottom-0 z-30">
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
                   Fixed position to prevent scrolling with content
                   ===============================================
                */}
                <aside className="hidden md:flex flex-col w-56 bg-slate-50 border-r fixed left-56 top-[60px] bottom-0 z-30">
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
                   Uses margin-left to account for fixed sidebars
                   ===============================================
                */}
                <main className={`flex-1 flex flex-col min-w-0 md:ml-[448px] ${isInventoryActive ? 'opacity-50 pointer-events-none grayscale' : ''}`}>

                    {/* Sticky Filters Area (Mobile Only: Category Tabs + SubCategory) */}
                    <div className="md:hidden sticky top-[60px] z-30 bg-slate-50 border-b shadow-sm">
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
                    <div className="p-4 bg-white min-h-full">

                        {/* Product Type Chips (Small Category) - Show if types exist and not searching */}
                        {productTypes.length > 0 && !searchQuery && (
                            <div className="mb-4 flex flex-wrap gap-2">
                                <span className="text-xs font-bold text-slate-400 py-1.5">タイプ:</span>
                                <button
                                    onClick={() => setSelectedProductType("すべて")}
                                    className={`
                                        px-3 py-1 rounded-full text-xs font-bold transition-colors border
                                        ${selectedProductType === "すべて"
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}
                                    `}
                                >
                                    すべて
                                </button>
                                {productTypes.map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setSelectedProductType(type)}
                                        className={`
                                            px-3 py-1 rounded-full text-xs font-bold transition-colors border
                                            ${selectedProductType === type
                                                ? "bg-blue-600 text-white border-blue-600"
                                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}
                                        `}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Manual Input Row (Mobile Optimized in Grid?) No, keep separate or first card? 
                            Keeping separate for now, but maybe styling it as a Card in grid?
                            Let's keep the dedicated mobile row for visibility in phone, 
                            but for tablet grid, maybe add a "Manual Add" card?
                            For now, keeping the mobile list row wrapper for 'md:hidden'
                        */}
                        <div className="md:hidden mb-4">
                            <ManualProductSheet trigger={
                                <div className="p-4 border rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer flex items-center gap-4 text-slate-600 transition-colors group shadow-sm">
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
                                {searchQuery ? `「${searchQuery}」に一致する商品は見つかりませんでした` :
                                    selectedCategory === "すべて" ? "カテゴリーを選択してください" : "該当する商品はありません"}
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {filteredProducts.map((product) => (
                                    <ProductListItem key={product.id} product={product} />
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div >

            {/* Footer Cart Summary */}
            < CartSummary />
        </div >
    );
}
