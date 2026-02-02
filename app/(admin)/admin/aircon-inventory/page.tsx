"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, Minus, AlertTriangle, Package, Save } from "lucide-react";
import { toast } from "sonner";
import {
    getAirconProducts,
    updateAirconStock,
    updateAirconProductSuffix,
} from "@/lib/aircon-actions";

type AirconProduct = {
    id: number;
    code: string;
    name: string;
    capacity: string;
    suffix: string;
    stock: number;
    minStock: number;
};

export default function AirconInventoryPage() {
    const [products, setProducts] = useState<AirconProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSuffix, setEditingSuffix] = useState<Record<number, string>>({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const prods = await getAirconProducts();
            setProducts(prods);
            // 初期サフィックス値をセット
            const suffixMap: Record<number, string> = {};
            prods.forEach((p: AirconProduct) => {
                suffixMap[p.id] = p.suffix || "N";
            });
            setEditingSuffix(suffixMap);
        } catch (e) {
            toast.error("データ取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    const handleStockAdjust = async (productId: number, adjustment: number) => {
        const result = await updateAirconStock(productId, adjustment);
        if (result.success) {
            toast.success(adjustment > 0 ? "在庫を追加しました" : "在庫を減らしました");
            fetchData();
        } else {
            toast.error(result.message);
        }
    };

    const handleSaveSuffix = async (productId: number) => {
        const suffix = editingSuffix[productId];
        if (!suffix?.trim()) {
            toast.error("サフィックスを入力してください");
            return;
        }
        const result = await updateAirconProductSuffix(productId, suffix.trim().toUpperCase());
        if (result.success) {
            toast.success("サフィックスを更新しました");
            fetchData();
        } else {
            toast.error("更新に失敗しました");
        }
    };

    const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
    const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">エアコン在庫管理</h2>
                <p className="text-muted-foreground">
                    ベースコード(RAS-AJ22等)で在庫管理、サフィックスは発注時のみ使用
                </p>
            </div>

            {/* 統計カード */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">総在庫</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalStock} 台</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">登録機種</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{products.length} 機種</div>
                    </CardContent>
                </Card>
                {lowStockCount > 0 && (
                    <Card className="border-amber-300 bg-amber-50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-amber-700">
                                在庫アラート
                            </CardTitle>
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-700">
                                {lowStockCount} 機種
                            </div>
                            <p className="text-xs text-amber-600">最低在庫数以下</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* 在庫テーブル */}
            <Card>
                <CardHeader>
                    <CardTitle>在庫一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ベースコード</TableHead>
                                    <TableHead>名称</TableHead>
                                    <TableHead>容量</TableHead>
                                    <TableHead className="text-center">発注サフィックス</TableHead>
                                    <TableHead className="text-center">現在庫</TableHead>
                                    <TableHead className="text-right">在庫調整</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((product) => {
                                    const isLowStock = product.stock <= product.minStock;
                                    const currentSuffix = editingSuffix[product.id] || "";
                                    const suffixChanged = currentSuffix !== product.suffix;

                                    return (
                                        <TableRow
                                            key={product.id}
                                            className={isLowStock ? "bg-amber-50" : ""}
                                        >
                                            <TableCell className="font-mono font-medium">
                                                {product.code}
                                                {isLowStock && (
                                                    <AlertTriangle className="inline w-4 h-4 ml-2 text-amber-500" />
                                                )}
                                            </TableCell>
                                            <TableCell>{product.name}</TableCell>
                                            <TableCell>{product.capacity}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-center gap-1">
                                                    <Input
                                                        value={currentSuffix}
                                                        onChange={(e) =>
                                                            setEditingSuffix({
                                                                ...editingSuffix,
                                                                [product.id]: e.target.value.toUpperCase(),
                                                            })
                                                        }
                                                        className="w-16 text-center font-mono"
                                                        maxLength={2}
                                                    />
                                                    {suffixChanged && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleSaveSuffix(product.id)}
                                                        >
                                                            <Save className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span
                                                    className={`font-bold text-lg ${isLowStock ? "text-amber-600" : "text-slate-900"
                                                        }`}
                                                >
                                                    {product.stock}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleStockAdjust(product.id, -1)}
                                                        disabled={product.stock === 0}
                                                    >
                                                        <Minus className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleStockAdjust(product.id, 1)}
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
