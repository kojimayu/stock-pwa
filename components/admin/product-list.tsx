"use client";

import { useState } from "react";
import { normalizeForSearch } from "@/lib/utils";
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
import { Edit, Plus, Trash2, PackagePlus, Search, X, Package, ChevronDown, ChevronUp } from "lucide-react";
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
    createdAt?: Date | string;
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
    const [showFilters, setShowFilters] = useState(false);
    const router = useRouter();

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

    const getMargin = (price: number, cost: number) => {
        if (price === 0) return 0;
        return ((price - cost) / price) * 100;
    };

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

    const filteredProducts = products.filter(product => {
        if (selectedCategory !== "all" && product.category !== selectedCategory) return false;
        if (selectedSubCategory !== "all" && product.subCategory !== selectedSubCategory) return false;
        if (selectedProductType !== "all" && product.productType !== selectedProductType) return false;
        if (!searchQuery) return true;
        const query = normalizeForSearch(searchQuery);
        return (
            normalizeForSearch(product.name).includes(query) ||
            normalizeForSearch(product.code).includes(query) ||
            (product.category && normalizeForSearch(product.category).includes(query)) ||
            (product.subCategory && normalizeForSearch(product.subCategory).includes(query)) ||
            (product.productType && normalizeForSearch(product.productType).includes(query)) ||
            (product.supplier && normalizeForSearch(product.supplier).includes(query)) ||
            (product.color && normalizeForSearch(product.color).includes(query))
        );
    });

    const hasActiveFilters = selectedCategory !== "all" || selectedSubCategory !== "all" || selectedProductType !== "all" || searchQuery !== "";

    return (
        <div className="space-y-4">
            {/* ヘッダー - モバイル対応 */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
                <div className="flex gap-4 items-center text-sm">
                    <div>
                        <span className="font-semibold text-muted-foreground mr-2">登録総数:</span>
                        <span className="font-bold text-lg">{totalCount}</span>
                        <span className="text-xs text-muted-foreground ml-1">件</span>
                    </div>
                    <div className="hidden sm:block h-4 w-px bg-border" />
                    <div className="hidden sm:block">
                        <span className="font-semibold text-muted-foreground mr-2">最終登録:</span>
                        <span className="font-medium text-xs">{lastUpdated}</span>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <ProductImportDialog />
                    <ProductExportButton products={products} />
                    <Button onClick={handleCreate} className="flex-1 md:flex-none">
                        <Plus className="w-4 h-4 mr-2" />
                        商品登録
                    </Button>
                </div>
            </div>

            {/* 検索とフィルター - モバイル対応 */}
            <div className="space-y-3">
                {/* 検索バー（常に表示） */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            type="search"
                            placeholder="商品名、品番で検索..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button
                        variant="outline"
                        className="md:hidden"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSelectedCategory("all");
                                setSelectedSubCategory("all");
                                setSelectedProductType("all");
                                setSearchQuery("");
                            }}
                        >
                            <X className="w-4 h-4 mr-1" />
                            クリア
                        </Button>
                    )}
                </div>

                {/* カテゴリフィルター - PC常時表示、モバイル展開式 */}
                <div className={`flex-col md:flex md:flex-row gap-2 ${showFilters ? 'flex' : 'hidden md:flex'}`}>
                    <Select
                        value={selectedCategory}
                        onValueChange={(val) => {
                            setSelectedCategory(val);
                            setSelectedSubCategory("all");
                            setSelectedProductType("all");
                        }}
                    >
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="カテゴリ(大)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">カテゴリ(大): 全て</SelectItem>
                            {attributeOptions.categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={selectedSubCategory}
                        onValueChange={(val) => {
                            setSelectedSubCategory(val);
                            setSelectedProductType("all");
                        }}
                    >
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="カテゴリ(中)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">カテゴリ(中): 全て</SelectItem>
                            {attributeOptions.subCategories.map((sub) => (
                                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedProductType} onValueChange={setSelectedProductType}>
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="カテゴリ(小)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">カテゴリ(小): 全て</SelectItem>
                            {attributeOptions.productTypes.map((type) => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* PC用テーブル表示 */}
            <div className="hidden md:block border rounded-lg">
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

            {/* モバイル用カード表示 */}
            <div className="md:hidden space-y-3">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-white rounded-lg border">
                        <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>登録されている商品がありません</p>
                    </div>
                ) : (
                    filteredProducts.map((product) => {
                        const margin = getMargin(product.priceA, product.cost);
                        return (
                            <div
                                key={product.id}
                                className="bg-white rounded-lg border shadow-sm p-4"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{product.name}</div>
                                        <div className="text-xs text-muted-foreground">{product.code}</div>
                                    </div>
                                    <div className={`text-lg font-bold ml-2 ${product.stock <= product.minStock ? "text-red-500" : ""}`}>
                                        在庫: {product.stock}
                                    </div>
                                </div>

                                <div className="text-xs text-muted-foreground mb-3">
                                    {product.category}
                                    {product.subCategory && ` > ${product.subCategory}`}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                    <div>
                                        <span className="text-muted-foreground">単価A:</span>
                                        <span className="ml-1 font-bold">{formatCurrency(product.priceA)}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">原価率:</span>
                                        <span className={`ml-1 font-bold ${margin < 20 ? "text-red-500" : "text-green-600"}`}>
                                            {product.priceA > 0 ? `${margin.toFixed(1)}%` : "-"}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2 border-t pt-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => handleAdjustStock(product)}
                                    >
                                        <PackagePlus className="w-4 h-4 mr-1" />
                                        在庫調整
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEdit(product)}
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(product.id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <ProductDialog
                open={productDialogOpen}
                onOpenChange={setProductDialogOpen}
                product={editingProduct}
                initialValues={{}}
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
