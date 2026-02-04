"use client";

import { useState } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Edit, Plus, Trash2, PackagePlus, Search, X } from "lucide-react";
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
    productType: string | null;
    priceA: number;
    priceB: number;
    priceC: number;
    stock: number;
    minStock: number;
    cost: number;
    unit: string;
    supplier?: string | null;
    color?: string | null;
    createdAt?: Date | string; // Added
};

interface ProductListProps {
    products: Product[];
}

export function ProductList({ products }: ProductListProps) {
    const [productDialogOpen, setProductDialogOpen] = useState(false);
    const [stockDialogOpen, setStockDialogOpen] = useState(false);

    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all");
    const [selectedProductType, setSelectedProductType] = useState<string>("all");
    const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
    const router = useRouter();

    // Stats
    const totalCount = products.length;
    const lastUpdated = products.length > 0
        ? new Date(Math.max(...products.map(p => new Date(p.createdAt || 0).getTime()))).toLocaleString('ja-JP')
        : "-";

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
    const attributeOptions = {
        categories: Array.from(new Set(products.map(p => p.category))).sort(),
        subCategories: Array.from(new Set(products
            .filter(p => selectedCategory === "all" || p.category === selectedCategory)
            .map(p => p.subCategory)
            .filter(Boolean) as string[]
        )).sort(),
        productTypes: Array.from(new Set(products
            .filter(p =>
                (selectedCategory === "all" || p.category === selectedCategory) &&
                (selectedSubCategory === "all" || p.subCategory === selectedSubCategory)
            )
            .map(p => p.productType)
            .filter(Boolean) as string[]
        )).sort(),
        suppliers: Array.from(new Set(products.map(p => p.supplier).filter(Boolean) as string[])).sort(),
    };

    // Filter products
    const filteredProducts = products.filter(product => {
        // Category Filter
        if (selectedCategory !== "all" && product.category !== selectedCategory) {
            return false;
        }

        // SubCategory Filter
        if (selectedSubCategory !== "all" && product.subCategory !== selectedSubCategory) {
            return false;
        }

        // ProductType Filter
        if (selectedProductType !== "all" && product.productType !== selectedProductType) {
            return false;
        }

        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            product.name.toLowerCase().includes(query) ||
            product.code.toLowerCase().includes(query) ||
            // Category text search logic can remain or be removed. Keeping it is fine for "flexible" search.
            (product.category && product.category.toLowerCase().includes(query)) ||
            (product.subCategory && product.subCategory.toLowerCase().includes(query)) ||
            (product.productType && product.productType.toLowerCase().includes(query)) ||
            (product.supplier && product.supplier.toLowerCase().includes(query)) ||
            (product.color && product.color.toLowerCase().includes(query))
        );
    });

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-lg border">
                <div className="flex gap-4 items-center">
                    <div className="text-sm">
                        <span className="font-semibold text-muted-foreground mr-2">登録総数:</span>
                        <span className="font-bold text-lg">{totalCount}</span>
                        <span className="text-xs text-muted-foreground ml-1">件</span>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="text-sm">
                        <span className="font-semibold text-muted-foreground mr-2">最終登録日時:</span>
                        <span className="font-medium">{lastUpdated}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <ProductImportDialog />
                    <ProductExportButton products={products} />
                    <Button onClick={handleCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        商品登録
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Category Select */}
                <div className="w-[180px]">
                    <Select
                        value={selectedCategory}
                        onValueChange={(val) => {
                            setSelectedCategory(val);
                            setSelectedSubCategory("all"); // Reset sub on main change
                            setSelectedProductType("all"); // Reset type on main change
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="カテゴリ(大)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">カテゴリ(大): 全て</SelectItem>
                            {attributeOptions.categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                    {cat}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* SubCategory Select */}
                <div className="w-[180px]">
                    <Select
                        value={selectedSubCategory}
                        onValueChange={(val) => {
                            setSelectedSubCategory(val);
                            setSelectedProductType("all"); // Reset type on sub change
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="カテゴリ(中)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">カテゴリ(中): 全て</SelectItem>
                            {attributeOptions.subCategories.map((sub) => (
                                <SelectItem key={sub} value={sub}>
                                    {sub}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* ProductType Select */}
                <div className="w-[180px]">
                    <Select value={selectedProductType} onValueChange={setSelectedProductType}>
                        <SelectTrigger>
                            <SelectValue placeholder="カテゴリ(小)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">カテゴリ(小): 全て</SelectItem>
                            {attributeOptions.productTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {type}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Search Input */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        type="search"
                        placeholder="商品名、品番、仕入先、色..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Reset Filters */}
                {(selectedCategory !== "all" || searchQuery !== "") && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSelectedCategory("all");
                            setSearchQuery("");
                        }}
                    >
                        <X className="w-4 h-4 mr-2" />
                        クリア
                    </Button>
                )}
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
                        {filteredProducts.map((product) => {
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
                        {filteredProducts.length === 0 && (
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
            )
            }
        </div >
    );
}
