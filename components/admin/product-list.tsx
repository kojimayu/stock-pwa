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
    unit: string;
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

    // Derive options from props
    // Using simple deduplication with Set
    const attributeOptions = {
        categories: Array.from(new Set(products.map(p => p.category))).sort(),
        subCategories: Array.from(new Set(products.map(p => p.subCategory).filter(Boolean) as string[])).sort(),
        suppliers: Array.from(new Set(products.map(p => p.supplier).filter(Boolean) as string[])).sort(),
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
                            <TableHead className="w-[100px]">ID</TableHead>
                            <TableHead>商品名</TableHead>
                            <TableHead>カテゴリ</TableHead>
                            <TableHead className="text-right">販売単価</TableHead>
                            <TableHead className="text-right">在庫</TableHead>
                            <TableHead className="text-right">原価率</TableHead>
                            <TableHead className="w-[100px]">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((product) => {
                            const margin = getMargin(product.priceA, product.cost);
                            return (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.code}</TableCell>
                                    <TableCell>
                                        <div>{product.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {product.supplier && <span className="mr-2">仕入: {product.supplier}</span>}
                                            {product.color && <span>色: {product.color}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div>{product.category}</div>
                                        {product.subCategory && (
                                            <div className="text-xs text-muted-foreground">{product.subCategory}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="font-bold">{formatCurrency(product.priceA)}</div>
                                        <div className="text-xs text-muted-foreground">
                                            B: {formatCurrency(product.priceB)} / C: {formatCurrency(product.priceC)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className={product.stock <= product.minStock ? "text-red-500 font-bold" : ""}>
                                            {product.stock}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs"
                                            onClick={() => handleAdjustStock(product)}
                                        >
                                            <PackagePlus className="w-3 h-3 mr-1" />
                                            調整
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className={margin < 20 ? "text-red-500" : "text-green-600"}>
                                            {product.priceA > 0 ? `${margin.toFixed(1)}%` : "-"}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            原価: {formatCurrency(product.cost)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {products.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                    登録されている商品がありません
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
                initialValues={{}} // Pass empty if unnecessary or adjust logic
                attributeOptions={attributeOptions}
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
