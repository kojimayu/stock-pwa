"use client";

import { useState, useMemo, useEffect } from "react";
import { normalizeForSearch } from "@/lib/utils";
import { VerticalCategoryList } from "@/components/kiosk/vertical-category-list";
import { VerticalSubCategoryList } from "@/components/kiosk/vertical-sub-category-list";
import { ProductListItem } from "@/components/kiosk/product-list-item";
import { ManualProductSheet } from "@/components/kiosk/manual-product-sheet";
import { CheckoutButton } from "@/components/kiosk/checkout-button";
import { Search, X, Plus, Minus, Trash2, ShoppingCart, ChevronDown } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { getJSTDateString } from "@/lib/date-utils";

import { Product } from "@/lib/types";

interface Vendor {
    id: number;
    name: string;
}

interface ProxyShopContentProps {
    products: Product[];
    vendor: Vendor;
}

export function ProxyShopContent({ products, vendor }: ProxyShopContentProps) {
    const [selectedCategory, setSelectedCategory] = useState("すべて");
    const [selectedSubCategory, setSelectedSubCategory] = useState("すべて");
    const [searchQuery, setSearchQuery] = useState("");
    const [pickupDate, setPickupDate] = useState<string>(
        getJSTDateString()
    );
    const [mobileTab, setMobileTab] = useState<"products" | "cart">("products");
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    const setVendor = useCartStore((state) => state.setVendor);
    const setProxyMode = useCartStore((state) => state.setProxyMode);
    const setTransactionDate = useCartStore((state) => state.setTransactionDate);
    const items = useCartStore((state) => state.items);
    const updateQuantity = useCartStore((state) => state.updateQuantity);
    const removeItem = useCartStore((state) => state.removeItem);
    const clearCart = useCartStore((state) => state.clearCart);

    useEffect(() => {
        setVendor(vendor);
        setProxyMode(true);
        setTransactionDate(new Date(pickupDate + "T00:00:00+09:00"));
        clearCart();
        return () => {
            setProxyMode(false);
            setTransactionDate(null);
        };
    }, [vendor, setVendor, setProxyMode, setTransactionDate, clearCart]);

    useEffect(() => {
        if (pickupDate) {
            setTransactionDate(new Date(pickupDate + "T00:00:00+09:00"));
        }
    }, [pickupDate, setTransactionDate]);

    const categories = useMemo(() => {
        return [...new Set(products.map((p) => p.category))];
    }, [products]);

    const subCategories = useMemo(() => {
        if (selectedCategory === "すべて") return [];
        const filtered = products.filter((p) => p.category === selectedCategory);
        return [...new Set(filtered.map((p) => p.subCategory || "その他"))];
    }, [products, selectedCategory]);

    const filteredProducts = useMemo(() => {
        let res = products;
        if (selectedCategory !== "すべて") {
            res = res.filter((p) => p.category === selectedCategory);
        }
        if (selectedSubCategory !== "すべて") {
            res = res.filter((p) => (p.subCategory || "その他") === selectedSubCategory);
        }
        if (searchQuery.trim()) {
            const q = normalizeForSearch(searchQuery);
            res = res.filter(
                (p) =>
                    normalizeForSearch(p.name).includes(q) ||
                    (p.code && normalizeForSearch(p.code).includes(q))
            );
        }
        return res;
    }, [products, selectedCategory, selectedSubCategory, searchQuery]);

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    // ========== モバイルレイアウト (md未満) ==========
    const mobileLayout = (
        <div className="flex flex-col h-full bg-slate-100">
            {/* カテゴリ選択ドロップダウン */}
            <div className="bg-slate-800 text-white p-2 flex-shrink-0">
                <button
                    className="w-full flex items-center justify-between px-3 py-2 rounded bg-slate-700 text-sm"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                >
                    <span>{selectedCategory}{selectedSubCategory !== "すべて" ? ` > ${selectedSubCategory}` : ""}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showCategoryDropdown ? "rotate-180" : ""}`} />
                </button>
                {showCategoryDropdown && (
                    <div className="mt-1 max-h-60 overflow-y-auto bg-slate-700 rounded p-1 space-y-0.5">
                        <button
                            className={`w-full text-left px-3 py-2 rounded text-sm ${selectedCategory === "すべて" ? "bg-blue-600" : "hover:bg-slate-600"}`}
                            onClick={() => { setSelectedCategory("すべて"); setSelectedSubCategory("すべて"); setShowCategoryDropdown(false); }}
                        >すべて</button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`w-full text-left px-3 py-2 rounded text-sm ${selectedCategory === cat ? "bg-blue-600" : "hover:bg-slate-600"}`}
                                onClick={() => { setSelectedCategory(cat); setSelectedSubCategory("すべて"); setShowCategoryDropdown(false); }}
                            >{cat}</button>
                        ))}
                    </div>
                )}
                {/* サブカテゴリ横スクロール */}
                {subCategories.length > 0 && (
                    <div className="flex gap-1 mt-1 overflow-x-auto pb-1">
                        <button
                            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs ${selectedSubCategory === "すべて" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300"}`}
                            onClick={() => setSelectedSubCategory("すべて")}
                        >すべて</button>
                        {subCategories.map(sub => (
                            <button
                                key={sub}
                                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs ${selectedSubCategory === sub ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300"}`}
                                onClick={() => setSelectedSubCategory(sub)}
                            >{sub}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* タブ切替：商品 / カート */}
            <div className="flex bg-white border-b flex-shrink-0">
                <button
                    className={`flex-1 py-2 text-sm font-medium ${mobileTab === "products" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500"}`}
                    onClick={() => setMobileTab("products")}
                >商品一覧</button>
                <button
                    className={`flex-1 py-2 text-sm font-medium relative ${mobileTab === "cart" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500"}`}
                    onClick={() => setMobileTab("cart")}
                >
                    <ShoppingCart className="w-4 h-4 inline mr-1" />
                    カート
                    {totalItems > 0 && (
                        <span className="absolute -top-1 right-4 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {totalItems}
                        </span>
                    )}
                </button>
            </div>

            {/* コンテンツ */}
            {mobileTab === "products" ? (
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {/* 検索バー */}
                    <div className="p-2 border-b bg-slate-50 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="search"
                                placeholder="商品名や品番で検索..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-9 pl-10 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {searchQuery && (
                                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery("")}>
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                        <ManualProductSheet trigger={
                            <Button variant="outline" size="sm" className="flex-shrink-0">
                                <Plus className="w-4 h-4" />
                            </Button>
                        } />
                    </div>
                    {/* 商品リスト */}
                    <div className="flex-1 overflow-y-auto p-2">
                        <div className="space-y-2">
                            {filteredProducts.map((product) => (
                                <ProductListItem key={product.id} product={product} />
                            ))}
                        </div>
                        {filteredProducts.length === 0 && (
                            <div className="text-center text-slate-500 py-12">商品が見つかりません</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {/* カートアイテム */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {items.length === 0 ? (
                            <div className="text-center text-slate-400 py-12 text-sm">商品をタップして追加</div>
                        ) : (
                            <div className="space-y-2">
                                {items.map((item) => (
                                    <div key={item.productId} className="p-3 bg-slate-50 rounded-lg border text-sm">
                                        <div className="font-medium mb-1">{item.name}</div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600">¥{item.price.toLocaleString()}</span>
                                            <div className="flex items-center gap-1">
                                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                                                    <Minus className="w-3 h-3" />
                                                </Button>
                                                <span className="w-6 text-center">{item.quantity}</span>
                                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                                                    <Plus className="w-3 h-3" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => removeItem(item.productId)}>
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* 合計・チェックアウト */}
                    <div className="p-3 border-t bg-slate-50 space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">引取日</label>
                            <input
                                type="date"
                                value={pickupDate}
                                onChange={(e) => setPickupDate(e.target.value)}
                                max={getJSTDateString()}
                                className="w-full h-9 px-3 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex justify-between">
                            <span className="font-bold">合計</span>
                            <span className="font-bold text-lg">¥{totalAmount.toLocaleString()}</span>
                        </div>
                        <CheckoutButton />
                    </div>
                </div>
            )}
        </div>
    );

    // ========== デスクトップレイアウト (md以上) ==========
    const desktopLayout = (
        <div className="flex h-full bg-slate-100">
            {/* カテゴリサイドバー */}
            <div className="w-44 bg-slate-800 text-white overflow-y-auto flex-shrink-0 flex flex-col">
                <div className="p-2 text-xs font-bold text-slate-400 border-b border-slate-700">カテゴリー</div>
                <div className="flex-1 overflow-y-auto">
                    <VerticalCategoryList
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onSelectCategory={(cat) => {
                            setSelectedCategory(cat);
                            setSelectedSubCategory("すべて");
                        }}
                    />
                </div>
                <div className="p-2 border-t border-slate-700">
                    <ManualProductSheet trigger={
                        <Button className="w-full bg-slate-700 hover:bg-slate-600 text-sm" size="sm">
                            <Plus className="w-4 h-4 mr-1" />
                            手入力商品
                        </Button>
                    } />
                </div>
            </div>

            {/* サブカテゴリ */}
            <div className="w-40 bg-slate-50 border-r overflow-y-auto flex-shrink-0">
                <div className="p-2 text-xs font-bold text-slate-400 border-b">サブカテゴリー</div>
                <VerticalSubCategoryList
                    subCategories={subCategories}
                    selectedSubCategory={selectedSubCategory}
                    onSelectSubCategory={setSelectedSubCategory}
                />
            </div>

            {/* 商品一覧 */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="p-3 border-b bg-slate-50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="search"
                            placeholder="商品名や品番で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-9 pl-10 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {searchQuery && (
                            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery("")}>
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                    <div className="space-y-2">
                        {filteredProducts.map((product) => (
                            <ProductListItem key={product.id} product={product} />
                        ))}
                    </div>
                    {filteredProducts.length === 0 && (
                        <div className="text-center text-slate-500 py-12">商品が見つかりません</div>
                    )}
                </div>
            </div>

            {/* カートパネル */}
            <div className="w-80 bg-white border-l flex flex-col flex-shrink-0">
                <div className="p-3 border-b bg-slate-50">
                    <h3 className="font-bold text-slate-800">カート ({totalItems}点)</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {items.length === 0 ? (
                        <div className="text-center text-slate-400 py-8 text-sm">商品をタップして追加</div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item) => (
                                <div key={item.productId} className="p-2 bg-slate-50 rounded border text-sm">
                                    <div className="font-medium truncate mb-1">{item.name}</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-600">¥{item.price.toLocaleString()}</span>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                                                <Minus className="w-3 h-3" />
                                            </Button>
                                            <span className="w-6 text-center">{item.quantity}</span>
                                            <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                                                <Plus className="w-3 h-3" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => removeItem(item.productId)}>
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-3 border-t bg-slate-50 space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">引取日</label>
                        <input
                            type="date"
                            value={pickupDate}
                            onChange={(e) => setPickupDate(e.target.value)}
                            max={getJSTDateString()}
                            className="w-full h-9 px-3 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold">合計</span>
                        <span className="font-bold text-lg">¥{totalAmount.toLocaleString()}</span>
                    </div>
                    <CheckoutButton />
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* モバイル */}
            <div className="md:hidden h-full">{mobileLayout}</div>
            {/* デスクトップ */}
            <div className="hidden md:block h-full">{desktopLayout}</div>
        </>
    );
}
