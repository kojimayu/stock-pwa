
"use client";

import { useState, useMemo, useEffect } from "react";
import { CategoryTabs } from "./category-tabs";
import { ProductListItem } from "./product-list-item";
import { ManualProductSheet } from "@/components/kiosk/manual-product-sheet";
import { CartSummary } from "./cart-summary";
import { LogOut, Plus, ChevronLeft, Search, X, Mic, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { normalizeForSearch } from "@/lib/utils";
import { MergedCategoryList } from "./merged-category-list";
import { CartSidebar } from "./cart-sidebar";
import { Product } from "@/lib/types";

// Add Web Speech API types
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}


interface ShopInterfaceProps {
    products: Product[];
    isInventoryActive: boolean;
    // 代理入力モード用
    proxyMode?: boolean;
    vendorOverride?: { id: number; name: string } | null;
    onProxyExit?: () => void;
}

import { getVendorReturnableProducts } from "@/lib/return-actions"; // Import action

interface ShopInterfaceProps {
    products: Product[];
    isInventoryActive: boolean;
    // 代理入力モード用
    proxyMode?: boolean;
    vendorOverride?: { id: number; name: string } | null;
    onProxyExit?: () => void;
}

export function ShopInterface({
    products: initialProducts, // Rename to initialProducts
    isInventoryActive,
    proxyMode = false,
    vendorOverride,
    onProxyExit
}: ShopInterfaceProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
    const [selectedProductType, setSelectedProductType] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isListening, setIsListening] = useState(false);

    // Sidebar State
    const [isCategoryOpen, setIsCategoryOpen] = useState(true);

    // Return Mode State
    const [returnableProducts, setReturnableProducts] = useState<Product[]>([]);
    const [isLoadingReturnables, setIsLoadingReturnables] = useState(false);

    const router = useRouter();
    const clearCart = useCartStore((state) => state.clearCart);
    const setVendor = useCartStore((state) => state.setVendor);
    const setProxyMode = useCartStore((state) => state.setProxyMode);
    const storeVendor = useCartStore((state) => state.vendor);
    const vendorUser = useCartStore((state) => state.vendorUser);
    const isReturnMode = useCartStore((state) => state.isReturnMode);

    // 代理入力モードではvendorOverrideを使用
    const vendor = proxyMode ? vendorOverride : storeVendor;

    // Determine which products to display
    const activeProducts = isReturnMode ? returnableProducts : initialProducts;

    // Fetch Returnable Products when entering Return Mode
    useEffect(() => {
        if (isReturnMode && vendor?.id) {
            setIsLoadingReturnables(true);
            getVendorReturnableProducts(vendor.id)
                .then((products) => {
                    // map to match Product type if needed, but action returns Product[] compatible objects
                    setReturnableProducts(products as Product[]);
                })
                .catch(console.error)
                .finally(() => setIsLoadingReturnables(false));
        } else {
            setReturnableProducts([]);
        }
    }, [isReturnMode, vendor?.id]);

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

    // Filter products
    const filteredProducts = useMemo(() => {
        let result = activeProducts; // Use activeProducts

        // Search Query
        if (searchQuery) {
            const normalizedQuery = normalizeForSearch(searchQuery);
            result = result.filter((product) => {
                const normalizedName = normalizeForSearch(product.name);
                const normalizedCode = product.code ? normalizeForSearch(product.code) : "";
                return normalizedName.includes(normalizedQuery) || normalizedCode.includes(normalizedQuery);
            });
        }

        // Category Filter
        if (selectedCategory && selectedCategory !== "すべて") {
            result = result.filter((product) => product.category === selectedCategory);
        }

        // SubCategory Filter
        if (selectedSubCategory && selectedSubCategory !== "すべて") {
            result = result.filter((product) => product.subCategory === selectedSubCategory);
        }

        // Product Type Filter (only if category and subcategory are selected)
        if (selectedCategory && selectedCategory !== "すべて" && selectedSubCategory && selectedSubCategory !== "すべて" && selectedProductType && selectedProductType !== "すべて") {
            result = result.filter((product) => product.productType === selectedProductType);
        }

        return result;
    }, [activeProducts, searchQuery, selectedCategory, selectedSubCategory, selectedProductType]);


    // Computed Lists for Mobile (Desktop uses MergedCategoryList which computes internally)
    const categories = useMemo(() => {
        const cats = new Set(activeProducts.map((p) => p.category));
        return Array.from(cats).sort();
    }, [activeProducts]);

    const subCategories = useMemo(() => {
        if (!selectedCategory || selectedCategory === "すべて") return [];
        const subs = new Set(
            activeProducts
                .filter((p) => p.category === selectedCategory && p.subCategory)
                .map((p) => p.subCategory!)
        );
        return Array.from(subs).sort();
    }, [activeProducts, selectedCategory]);

    const productTypes = useMemo(() => {
        if (!selectedCategory || selectedCategory === "すべて") return [];
        let target = activeProducts.filter(p => p.category === selectedCategory);
        if (selectedSubCategory && selectedSubCategory !== "すべて") {
            target = target.filter(p => p.subCategory === selectedSubCategory);
        }
        const types = new Set(target.filter(p => p.productType).map(p => p.productType!));
        return Array.from(types).sort();
    }, [activeProducts, selectedCategory, selectedSubCategory]);


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
            <header className={`${isReturnMode ? 'bg-orange-600' : 'bg-slate-900'} text-white p-3 fixed top-0 left-0 right-0 z-40 flex justify-between items-center shadow-md h-[60px] transition-colors duration-300`}>
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


                <div className="flex items-center space-x-1">
                    <Button
                        variant="outline"
                        size="sm"
                        className="bg-amber-500/20 border-amber-400 text-amber-100 hover:bg-amber-500/30 hover:text-white font-bold"
                        onClick={() => router.push("/shop/history")}
                    >
                        <FileText className="w-4 h-4 mr-1" />
                        履歴・返品
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
            <div className="flex-1 flex flex-row relative min-h-0">

                {/* 
                   ===============================================
                   Left Column: Category Tree (Desktop Only)
                   ===============================================
                */}
                <aside
                    className={`hidden md:block bg-white border-r fixed left-0 top-[60px] bottom-0 z-30 overflow-y-auto transition-all duration-300 ${isCategoryOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'}`}
                >
                    <div className="w-72">
                        {/* カテゴリサイドバーヘッダー（閉じるボタン付き） */}
                        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b">
                            <span className="text-sm font-bold text-slate-700">カテゴリー</span>
                            <button
                                onClick={() => setIsCategoryOpen(false)}
                                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                title="カテゴリーを閉じる"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <MergedCategoryList
                            products={activeProducts}
                            selectedCategory={selectedCategory}
                            selectedSubCategory={selectedSubCategory}
                            selectedProductType={selectedProductType}
                            onSelectCategory={setSelectedCategory}
                            onSelectSubCategory={setSelectedSubCategory}
                            onSelectProductType={setSelectedProductType}
                        />
                        <div className="p-4 border-t bg-slate-50 sticky bottom-0">
                            <ManualProductSheet trigger={
                                <Button className="w-full h-12 bg-slate-800 text-white hover:bg-slate-700 font-bold shadow-sm">
                                    <Plus className="w-5 h-5 mr-2" />
                                    手入力商品
                                </Button>
                            } />
                        </div>
                    </div>
                </aside>

                {/* Sidebar Toggle Button (Floating) */}
                <button
                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                    className={`hidden md:flex items-center justify-center fixed bottom-6 left-6 z-40 bg-slate-900 text-white w-12 h-12 rounded-full shadow-lg transition-all duration-300 hover:bg-slate-800 ${isCategoryOpen ? 'translate-x-64' : 'translate-x-0'}`}
                    title={isCategoryOpen ? "カテゴリーを閉じる" : "カテゴリーを開く"}
                >
                    {isCategoryOpen ? <ChevronLeft className="w-6 h-6" /> : <Search className="w-6 h-6" />}
                </button>

                {/* 
                   ===============================================
                   Center Column: Product List
                   ===============================================
                */}
                <main
                    className={`flex-1 flex flex-col transition-all duration-300 min-w-0 ${isCategoryOpen ? 'md:ml-72' : 'md:ml-0'} md:mr-[400px] ${isInventoryActive ? 'opacity-50 pointer-events-none grayscale' : ''}`}
                >

                    {/* Mobile Filters */}
                    <div className="md:hidden sticky top-[60px] z-30 bg-slate-50 border-b shadow-sm">
                        <div className="overflow-x-auto">
                            <CategoryTabs
                                categories={categories}
                                selectedCategory={selectedCategory || "すべて"}
                                onSelectCategory={setSelectedCategory}
                            />
                        </div>
                        {subCategories.length > 0 && (
                            <div className="flex overflow-x-auto px-2 py-2 gap-2 bg-white border-t border-slate-100 no-scrollbar items-center">
                                <span className="text-xs text-slate-400 pl-2 whitespace-nowrap hidden sm:inline">絞り込み:</span>
                                <button onClick={() => setSelectedSubCategory("すべて")} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors border shadow-sm ${(!selectedSubCategory || selectedSubCategory === "すべて") ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>すべて</button>
                                {subCategories.map((sub) => (
                                    <button key={sub} onClick={() => setSelectedSubCategory(sub)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors border shadow-sm ${(selectedSubCategory === sub) ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>{sub}</button>
                                ))}
                            </div>
                        )}
                        {/* Mobile Product Type (Optional) */}
                        {productTypes.length > 0 && (
                            <div className="flex overflow-x-auto px-2 pb-2 gap-2 bg-white no-scrollbar items-center">
                                <span className="text-xs text-slate-400 pl-2 whitespace-nowrap">タイプ:</span>
                                <button onClick={() => setSelectedProductType("すべて")} className={`whitespace-nowrap px-2 py-1 rounded-full text-xs transition-colors border ${(!selectedProductType || selectedProductType === "すべて") ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"}`}>All</button>
                                {productTypes.map((typ) => (
                                    <button key={typ} onClick={() => setSelectedProductType(typ)} className={`whitespace-nowrap px-2 py-1 rounded-full text-xs transition-colors border ${(selectedProductType === typ) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"}`}>{typ}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white min-h-full">
                        {/* Manual Input (Mobile) */}
                        <div className="md:hidden mb-4">
                            <ManualProductSheet trigger={
                                <div className="p-4 border rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer flex items-center gap-4 text-slate-600 transition-colors group shadow-sm">
                                    <div className="w-12 h-12 rounded-full bg-white border border-dashed border-slate-300 flex items-center justify-center group-hover:border-slate-500 group-hover:bg-slate-50">
                                        <Plus className="w-6 h-6 text-slate-400 group-hover:text-slate-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold">手入力で追加する</div>
                                        <div className="text-xs text-slate-400">一覧にない商品</div>
                                    </div>
                                </div>
                            } />
                        </div>

                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-20 text-slate-500">
                                {searchQuery ? `「${searchQuery}」に一致する商品は見つかりませんでした` :
                                    (!selectedCategory || selectedCategory === "すべて") ? "カテゴリーを選択してください" : "商品がありません"}
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

                {/* 
                   ===============================================
                   Right Column: Persistent Cart (Desktop Only)
                   ===============================================
                */}
                <aside className="hidden md:block w-[400px] bg-white border-l fixed right-0 top-[60px] bottom-0 z-30">
                    <CartSidebar />
                </aside>

            </div>

            {/* Mobile Footer Cart Summary (Mobile Only) */}
            <div className="md:hidden">
                <CartSummary />
            </div>
        </div>
    );
}
