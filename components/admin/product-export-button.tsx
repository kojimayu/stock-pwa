"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface Product {
    code: string;
    name: string;
    category: string;
    subCategory: string | null;
    priceA: number;
    priceB: number;
    priceC: number;
    minStock: number;
    stock: number;
    cost: number;
    supplier?: string | null;
    color?: string | null;
}

interface ProductExportButtonProps {
    products: Product[];
}

export function ProductExportButton({ products }: ProductExportButtonProps) {
    const handleExport = () => {
        try {
            const data = products.map((p) => ({
                code: p.code,
                name: p.name,
                category: p.category,
                subCategory: p.subCategory,
                priceA: p.priceA,
                priceB: p.priceB,
                priceC: p.priceC,
                minStock: p.minStock,
                cost: p.cost,
                supplier: p.supplier,
                color: p.color,
                stock: p.stock // Export current stock too
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);

            // Auto width
            const wscols = Object.keys(data[0] || {}).map(k => ({ wch: 20 }));
            ws['!cols'] = wscols;

            XLSX.utils.book_append_sheet(wb, ws, "Products");

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `products_export_${dateStr}.xlsx`);

            toast.success(`${products.length}件の商品をエクスポートしました`);
        } catch (error) {
            console.error(error);
            toast.error("エクスポートに失敗しました");
        }
    };

    return (
        <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            エクスポート
        </Button>
    );
}
