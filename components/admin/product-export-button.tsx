"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface Product {
    id: number;
    code: string;
    name: string;
    category: string;
    subCategory: string | null;
    productType: string | null;
    priceA: number;
    priceB: number;
    priceC: number;
    minStock: number;
    stock: number;
    cost: number;
    supplier?: string | null;
    color?: string | null;
    orderUnit?: number;
}

interface ProductExportButtonProps {
    products: Product[];
}

export function ProductExportButton({ products }: ProductExportButtonProps) {
    const handleExport = () => {
        try {
            const data = products.map((p) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                category: p.category,
                subCategory: p.subCategory,
                productType: p.productType, // Added
                priceA: p.priceA,
                priceB: p.priceB,
                priceC: p.priceC,
                minStock: p.minStock,
                cost: p.cost,
                supplier: p.supplier,
                color: p.color,
                orderUnit: p.orderUnit || 1, // Added
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
