"use client";

import { useState, useMemo, useEffect } from "react";
import { normalizeForSearch } from "@/lib/utils";
import { VerticalCategoryList } from "@/components/kiosk/vertical-category-list";
import { VerticalSubCategoryList } from "@/components/kiosk/vertical-sub-category-list";
import { ProductListItem } from "@/components/kiosk/product-list-item";
import { ManualProductSheet } from "@/components/kiosk/manual-product-sheet";
import { CheckoutButton } from "@/components/kiosk/checkout-button";
import { Search, X, Plus, Minus, Trash2 } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

interface Product {
    id: number;
    code?: string;
    name: string;
    category: string;
    subCategory?: string | null;
    productType?: string | null;
    priceA: number;
    priceB: number;
    stock: number;
    minStock: number;
}

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
        new Date().toISOString().split('T')[0] // 今日の日付をデフォルト
    );

    const setVendor = useCartStore((state) => state.setVendor);
    const setProxyMode = useCartStore((state) => state.setProxyMode);
    const setTransactionDate = useCartStore((state) => state.setTransactionDate);
    const items = useCartStore((state) => state.items);
    const updateQuantity = useCartStore((state) => state.updateQuantity);
    const removeItem = useCartStore((state) => state.removeItem);
    const clearCart = useCartStore((state) => state.clearCart);

    // 代理入力モード設定
    useEffect(() => {
        setVendor(vendor);
        setProxyMode(true);
        setTransactionDate(new Date(pickupDate));
        clearCart(); // 新しいセッション開始時にカートをクリア
        return () => {
            setProxyMode(false);
            setTransactionDate(null);
        };
    }, [vendor, setVendor, setProxyMode, setTransactionDate, clearCart]);

    // 引取日が変更されたらストアを更新
    useEffect(() => {
        if (pickupDate) {
            setTransactionDate(new Date(pickupDate));
        }
    }, [pickupDate, setTransactionDate]);

    // カテゴリ一覧（コンポーネント内部で「すべて」が追加されるため除外）
    const categories = useMemo(() => {
        return [...new Set(products.map((p) => p.category))];
    }, [products]);

    // サブカテゴリ一覧（コンポーネント内部で「すべて」が追加されるため除外）
    const subCategories = useMemo(() => {
        if (selectedCategory === "すべて") return [];
        const filtered = products.filter((p) => p.category === selectedCategory);
        return [...new Set(filtered.map((p) => p.subCategory || "その他"))];
    }, [products, selectedCategory]);

    // フィルタリング
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

    return (
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
                {/* 手入力ボタン */}
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
                {/* 検索バー */}
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
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                onClick={() => setSearchQuery("")}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* 商品グリッド */}
                <div className="flex-1 overflow-y-auto p-3">
                    <div className="space-y-2">
                        {filteredProducts.map((product) => (
                            <ProductListItem key={product.id} product={product} />
                        ))}
                    </div>
                    {filteredProducts.length === 0 && (
                        <div className="text-center text-slate-500 py-12">
                            商品が見つかりません
                        </div>
                    )}
                </div>
            </div>

            {/* カートパネル */}
            <div className="w-80 bg-white border-l flex flex-col flex-shrink-0">
                <div className="p-3 border-b bg-slate-50">
                    <h3 className="font-bold text-slate-800">カート ({totalItems}点)</h3>
                </div>

                {/* カートアイテム */}
                <div className="flex-1 overflow-y-auto p-2">
                    {items.length === 0 ? (
                        <div className="text-center text-slate-400 py-8 text-sm">
                            商品をタップして追加
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item) => (
                                <div key={item.productId} className="p-2 bg-slate-50 rounded border text-sm">
                                    <div className="font-medium truncate mb-1">{item.name}</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-600">¥{item.price.toLocaleString()}</span>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                className="h-6 w-6"
                                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                            >
                                                <Minus className="w-3 h-3" />
                                            </Button>
                                            <span className="w-6 text-center">{item.quantity}</span>
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                className="h-6 w-6"
                                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                            >
                                                <Plus className="w-3 h-3" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 text-red-500"
                                                onClick={() => removeItem(item.productId)}
                                            >
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
                    {/* 引取日 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">引取日</label>
                        <input
                            type="date"
                            value={pickupDate}
                            onChange={(e) => setPickupDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
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
}
