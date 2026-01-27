"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { getProducts } from "@/lib/actions"; // Assuming this exists, or use getAllProducts
import { formatCurrency } from "@/lib/utils";

interface ProductSearchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (productId: number) => void;
}

// We need a simple type for search results
type ProductSummary = {
    id: number;
    code: string;
    name: string;
    priceA: number;
    stock: number;
};

export function ProductSearchDialog({ open, onOpenChange, onSelect }: ProductSearchDialogProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<ProductSummary[]>([]);
    const [loading, setLoading] = useState(false);

    // Initial load (optional) or search on type
    // For simplicity, let's load all or search dynamically. 
    // Since getProducts returns all, we can filter client side or implement server search.
    // Let's implement client side filtering for now if list is small, or use a new search action?
    // Let's use getProducts() which we know returns all (from list usage).

    // Better: Fetch all once when open? Or use a Server Action for search?
    // Let's use a simple effect to fetch all matching query.

    useEffect(() => {
        if (open) {
            setQuery("");
            setResults([]);
            // Could load recent or all?
        }
    }, [open]);

    const handleSearch = async () => {
        setLoading(true);
        try {
            // Re-using getProducts for now. In real app, create searchProducts(query).
            const allProducts = await getProducts();
            // In a real large app this is bad, but for v1 it's fine.

            const filtered = allProducts.filter(p =>
                p.name.includes(query) || p.code.includes(query)
            );
            setResults(filtered.map(p => ({
                id: p.id,
                code: p.code,
                name: p.name,
                priceA: p.priceA,
                stock: p.stock
            })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
                <DialogHeader>
                    <DialogTitle>商品を検索して紐付け</DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 py-4">
                    <Input
                        placeholder="商品名または型番で検索..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto border rounded-md">
                    {results.length === 0 && !loading && (
                        <div className="text-center py-10 text-slate-500">
                            {query ? "見つかりませんでした" : "検索してください"}
                        </div>
                    )}
                    {results.map((product) => (
                        <div
                            key={product.id}
                            className="p-3 border-b last:border-0 hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                            onClick={() => {
                                onSelect(product.id);
                                onOpenChange(false);
                            }}
                        >
                            <div>
                                <div className="font-bold text-sm">{product.name}</div>
                                <div className="text-xs text-slate-500">ID: {product.code}</div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-sm">{formatCurrency(product.priceA)}</div>
                                <div className="text-xs text-slate-500">在庫: {product.stock}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
