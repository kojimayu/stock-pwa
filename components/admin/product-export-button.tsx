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
    manufacturer?: string | null;
    quantityPerBox?: number;
    pricePerBox?: number;
}

interface ProductExportButtonProps {
    products: Product[];
}

export function ProductExportButton({ products }: ProductExportButtonProps) {
    const handleExport = () => {
        try {
            const data = products.map((p) => ({
                "ID": p.id,
                "商品コード": p.code,
                "商品名": p.name,
                "カテゴリ": p.category,
                "サブカテゴリ": p.subCategory,
                "種類": p.productType,
                "販売単価A": p.priceA,
                "販売単価B": p.priceB,
                "販売単価C": p.priceC,
                "最低在庫": p.minStock,
                "現在在庫": p.stock,
                "仕入原価": p.cost,
                "仕入先": p.supplier,
                "色": p.color,
                "発注単位": p.orderUnit || 1,
                "メーカー": p.manufacturer || '',
                "箱入数": p.quantityPerBox || 1,
                "箱単価": p.pricePerBox || 0,
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
