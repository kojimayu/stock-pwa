"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Edit, Plus, Trash2, PackagePlus } from "lucide-react";
import { ProductDialog } from "./product-dialog";
import { StockAdjustmentDialog } from "./stock-adjustment-dialog";
import { deleteProduct } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { ProductImportDialog } from "./product-import-dialog";
import { ProductExportButton } from "./product-export-button";

type Product = {
    id: number;
    code: string;
    name: string;
    category: string;
    subCategory: string | null;
    priceA: number;
    priceB: number;
    priceC: number;
    stock: number;
    minStock: number;
    cost: number;
    supplier?: string | null;
    color?: string | null;
};

interface ProductListProps {
    products: Product[];
}

export function ProductList({ products }: ProductListProps) {
    const [productDialogOpen, setProductDialogOpen] = useState(false);
    const [stockDialogOpen, setStockDialogOpen] = useState(false);

    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

    const router = useRouter();

    const handleCreate = () => {
        setEditingProduct(null);
        setProductDialogOpen(true);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setProductDialogOpen(true);
    };

    const handleAdjustStock = (product: Product) => {
        setAdjustingProduct(product);
        setStockDialogOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("本当に削除しますか？")) return;
        try {
            await deleteProduct(id);
            toast.success("削除しました");
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || "削除に失敗しました");
        }
    };

    const handleSuccess = () => {
        router.refresh();
    };

    // Helper to calculate profit margin
    const getMargin = (price: number, cost: number) => {
        if (price === 0) return 0;
        return ((price - cost) / price) * 100;
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    <ProductExportButton products={products} />
                    <ProductImportDialog />
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    商品登録
                </Button>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">ID (Code)</TableHead>
                            <TableHead>商品名 / 色</TableHead>
                            <TableHead>カテゴリ</TableHead>
                            <TableHead className="text-right">在庫</TableHead>
                            <TableHead className="text-right">原価</TableHead>
                            <TableHead className="text-right">売価A (利益率)</TableHead>
                            <TableHead className="text-right whitespace-nowrap">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((product) => {
                            const margin = getMargin(product.priceA, product.cost);
                            const isLowMargin = margin < 10;

                            return (
                                <TableRow key={product.id}>
                                    <TableCell className="font-mono text-xs">{product.code}</TableCell>
                                    <TableCell className="font-medium">
                                        <div>{product.name}</div>
                                        {product.color && <div className="text-xs text-muted-foreground">{product.color}</div>}
                                        {product.stock <= product.minStock && (
                                            <span className="text-xs text-red-500 font-bold">(在庫少)</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {product.category}
                                        {product.supplier && <div className="text-xs text-muted-foreground">{product.supplier}</div>}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-lg">
                                        {product.stock}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {formatCurrency(product.cost)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div>{formatCurrency(product.priceA)}</div>
                                        <div className={`text-xs ${isLowMargin ? 'text-red-500 font-bold' : 'text-green-600'}`}>
                                            {margin.toFixed(1)}%
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                                        <Button variant="outline" size="sm" onClick={() => handleAdjustStock(product)} title="在庫調整">
                                            <PackagePlus className="w-4 h-4 mr-1" />
                                            在庫調整
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(product)} title="編集">
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(product.id)} title="削除">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {products.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                                    商品が登録されていません
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <ProductDialog
                open={productDialogOpen}
                onOpenChange={setProductDialogOpen}
                product={editingProduct}
                onSuccess={handleSuccess}
            />

            {adjustingProduct && (
                <StockAdjustmentDialog
                    open={stockDialogOpen}
                    onOpenChange={setStockDialogOpen}
                    product={adjustingProduct}
                    onSuccess={handleSuccess}
                />
            )}
        </div>
    );
}
