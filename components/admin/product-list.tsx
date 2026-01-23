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

type Product = {
    id: number;
    name: string;
    category: string;
    priceA: number;
    priceB: number;
    stock: number;
    minStock: number;
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

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    商品登録
                </Button>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">ID</TableHead>
                            <TableHead>商品名</TableHead>
                            <TableHead>カテゴリ</TableHead>
                            <TableHead className="text-right">在庫</TableHead>
                            <TableHead className="text-right">価格A</TableHead>
                            <TableHead className="text-right whitespace-nowrap">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((product) => (
                            <TableRow key={product.id}>
                                <TableCell>{product.id}</TableCell>
                                <TableCell className="font-medium">
                                    {product.name}
                                    {product.stock <= product.minStock && (
                                        <span className="ml-2 text-xs text-red-500 font-bold">(少)</span>
                                    )}
                                </TableCell>
                                <TableCell>{product.category}</TableCell>
                                <TableCell className="text-right font-bold text-lg">
                                    {product.stock}
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(product.priceA)}</TableCell>
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
                        ))}
                        {products.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-slate-500">
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
