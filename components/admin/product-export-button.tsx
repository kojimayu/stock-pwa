"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { getProducts } from "@/lib/actions";
import { toast } from "sonner";
import { format } from "date-fns";

export function ProductExportButton() {
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            const products = await getProducts();

            if (!products || products.length === 0) {
                toast.error("エクスポートするデータがありません");
                return;
            }

            // Format data for Excel
            const rows = products.map(p => ({
                code: p.code,
                name: p.name,
                category: p.category,
                subCategory: p.subCategory || "",
                color: p.color || "",
                priceA: p.priceA,
                priceB: p.priceB,
                priceC: p.priceC,
                cost: p.cost,
                minStock: p.minStock,
                supplier: p.supplier || "",
                stock: p.stock // Export stock just for reference, though import logic ignores it
            }));

            // Create Header (Match Import Format)
            // Use Japanese headers for user friendliness if preferred, OR keep English keys.
            // Our import dialog handles both English keys and Japanese keys.
            // Let's use English keys to match the internal structure, or mapped Japanese headers.
            // Import Dialog keys: code, name, category, subCategory, priceA...
            // Let's stick to keys for simplicity, or provide a header row.

            // To make it easy to re-import, we will use the exact keys expected by the importer, 
            // but mapped to readable headers if possible.
            // However, XLSX utils `json_to_sheet` uses input keys as headers by default.
            // Let's use English keys because `ProductImportDialog` supports them natively and it is safer.

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

            // Generate filename with date
            const dateStr = format(new Date(), "yyyyMMdd_HHmm");
            const fileName = `products_export_${dateStr}.xlsx`;

            // Download
            XLSX.writeFile(workbook, fileName);
            toast.success("エクスポートしました");

        } catch (error) {
            console.error("Export Error:", error);
            toast.error("エクスポート中にエラーが発生しました");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button variant="outline" onClick={handleExport} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Excelエクスポート
        </Button>
    );
}
