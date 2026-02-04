"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft, Search, ShoppingCart, Plus, Minus, Trash2,
    CheckCircle, Loader2, AlertTriangle, Package
} from "lucide-react";
import { createTransaction } from "@/lib/actions";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface Vendor {
    id: number;
    name: string;
    accessCompanyName?: string | null;
}

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

interface CartItem {
    productId: number;
    name: string;
    price: number;
    quantity: number;
}

interface ProxyShopInterfaceProps {
    products: Product[];
    vendor: Vendor;
    onExit: () => void;
}

export function ProxyShopInterface({ products, vendor, onExit }: ProxyShopInterfaceProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);

    // Filter products by search
    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return products.slice(0, 50); // Show first 50
        const q = searchQuery.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.code && p.code.toLowerCase().includes(q))
        );
    }, [products, searchQuery]);

    // Cart operations
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.productId === product.id);
            if (existing) {
                return prev.map(item =>
                    item.productId === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, {
                productId: product.id,
                name: product.name,
                price: product.priceA,
                quantity: 1,
            }];
        });
    };

    const updateQuantity = (productId: number, delta: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.productId === productId) {
                    const newQty = item.quantity + delta;
                    return newQty > 0 ? { ...item, quantity: newQty } : item;
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };

    const removeFromCart = (productId: number) => {
        setCart(prev => prev.filter(item => item.productId !== productId));
    };

    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    // Checkout
    const handleCheckout = async () => {
        setShowConfirmDialog(false);
        setIsCheckingOut(true);
        try {
            await createTransaction(
                vendor.id,
                cart.map(item => ({
                    productId: item.productId,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                })),
                totalAmount,
                true // isProxyInput flag
            );
            setShowSuccessDialog(true);
            setCart([]);
        } catch (error: any) {
            toast.error(error.message || "取引の登録に失敗しました");
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header with vendor info and exit button */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <div>
                        <p className="font-medium text-amber-900">
                            代理入力モード: {vendor.name}
                        </p>
                        <p className="text-xs text-amber-700">
                            この操作は管理者として記録されます
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={onExit}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    終了
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Product search and list */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="商品名または品番で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
                        {filteredProducts.map((product) => (
                            <Card
                                key={product.id}
                                className="cursor-pointer hover:border-primary transition-colors"
                                onClick={() => addToCart(product)}
                            >
                                <CardContent className="p-3">
                                    <div className="text-xs text-muted-foreground mb-1">
                                        {product.code}
                                    </div>
                                    <div className="font-medium text-sm line-clamp-2 mb-2">
                                        {product.name}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold">
                                            ¥{product.priceA.toLocaleString()}
                                        </span>
                                        <Badge variant={product.stock > 0 ? "secondary" : "destructive"}>
                                            在庫: {product.stock}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Cart */}
                <div className="space-y-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <ShoppingCart className="w-5 h-5" />
                                <span className="font-bold">カート ({totalItems}点)</span>
                            </div>

                            {cart.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">
                                    商品をクリックして追加
                                </p>
                            ) : (
                                <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                                    {cart.map((item) => (
                                        <div key={item.productId} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">
                                                    {item.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    ¥{item.price.toLocaleString()} × {item.quantity}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-7 w-7"
                                                    onClick={() => updateQuantity(item.productId, -1)}
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </Button>
                                                <span className="w-8 text-center text-sm">
                                                    {item.quantity}
                                                </span>
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-7 w-7"
                                                    onClick={() => updateQuantity(item.productId, 1)}
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-red-500"
                                                    onClick={() => removeFromCart(item.productId)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {cart.length > 0 && (
                                <>
                                    <div className="border-t mt-4 pt-4">
                                        <div className="flex justify-between items-center text-lg font-bold">
                                            <span>合計</span>
                                            <span>¥{totalAmount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full mt-4"
                                        size="lg"
                                        onClick={() => setShowConfirmDialog(true)}
                                        disabled={isCheckingOut}
                                    >
                                        {isCheckingOut ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                        )}
                                        確定する
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Confirm Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>取引を確定しますか？</DialogTitle>
                        <DialogDescription>
                            {vendor.name} の代理として以下の取引を登録します。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                            <p><strong>業者:</strong> {vendor.name}</p>
                            <p><strong>商品数:</strong> {totalItems}点</p>
                            <p><strong>合計金額:</strong> ¥{totalAmount.toLocaleString()}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                            キャンセル
                        </Button>
                        <Button onClick={handleCheckout}>
                            確定する
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Success Dialog */}
            <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            取引を登録しました
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-center">
                        <p className="text-muted-foreground">
                            {vendor.name} の代理入力が完了しました。
                        </p>
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={onExit}>
                            代理入力を終了
                        </Button>
                        <Button onClick={() => setShowSuccessDialog(false)}>
                            続けて入力
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
