"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { importProducts } from "@/lib/actions";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProductImportRow {
    code: string;
    name: string;
    category: string;
    subCategory: string | null; // Changed to match strict type if needed, but parsing usually handles strings
    productType?: string; // Added
    priceA: number;
    priceB: number;
    priceC: number;
    minStock?: number;
    cost: number;
    supplier?: string;
    color?: string;
    unit?: string;
    // For expansion logic
    isColor?: string | boolean;
    ISCOLOR?: string | boolean;
    is_color?: string | boolean;
    色展開?: string | boolean;
}

export function ProductImportDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState<ProductImportRow[]>([]);

    // Helper to normalize product code (remove hyphens, spaces, convert full-width to half-width)
    const normalizeCode = (code: string) => {
        if (!code) return "";
        return code
            .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)) // Full-width to Half-width
            .replace(/[-\s]/g, "") // Remove hyphens and spaces
            .toUpperCase();
    };

    const COLORS = [
        { name: "アイボリー", suffix: "-I" },
        { name: "ブラウン", suffix: "-BR" },
        { name: "ブラック", suffix: "-B" },
        { name: "ホワイト", suffix: "-W" },
        { name: "グレー", suffix: "-G" },
    ];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json<any>(ws);

            const expandedData: ProductImportRow[] = [];

            data.forEach((row: any) => {
                const isColor = row.isColor || row.ISCOLOR || row.is_color || row.色展開;
                const rawCode = String(row.code || row.CODE || row.型番 || row["商品コード"] || row["品番"] || "");
                const baseName = String(row.name || row.NAME || row.品名 || row.商品名 || "");
                const baseCode = normalizeCode(rawCode);

                const commonProps = {
                    category: String(row.category || row.CATEGORY || row.カテゴリ || row.カテゴリー大 || ""),
                    subCategory: String(row.subCategory || row.SUBCATEGORY || row.サブカテゴリ || row.カテゴリー中 || ""),
                    productType: row.productType || row.PRODUCTTYPE || row.カテゴリー小 || row.カテゴリ小 ? String(row.productType || row.PRODUCTTYPE || row.カテゴリー小 || row.カテゴリ小) : undefined,
                    priceA: Number(row.priceA || row.PRICEA || row.売価A || row.売値A || row.定価 || 0),
                    priceB: Number(row.priceB || row.PRICEB || row.売価B || row.売値B || row.特価 || 0),
                    priceC: Number(row.priceC || row.PRICEC || row.売価C || row.売値C || 0),
                    minStock: row.minStock || row.MINSTOCK || row.下限在庫 ? Number(row.minStock || row.MINSTOCK || row.下限在庫) : 0,
                    cost: Number(row.cost || row.COST || row.原価 || row.仕入単価 || row.仕入れ値 || 0),
                    supplier: row.supplier || row.SUPPLIER || row.仕入先 || row.メーカー ? String(row.supplier || row.SUPPLIER || row.仕入先 || row.メーカー) : undefined,
                    unit: row.unit || row.UNIT || row.単位 ? String(row.unit || row.UNIT || row.単位) : undefined,
                };

                // Check for True/1/'〇' (loose check)
                const isColorFlag = isColor && (String(isColor).toUpperCase() === "TRUE" || String(isColor) === "1" || String(isColor) === "〇");

                if (isColorFlag) {
                    // Expand to 5 colors
                    COLORS.forEach((color) => {
                        expandedData.push({
                            code: baseCode + color.suffix,
                            name: baseName + ` (${color.name})`,
                            color: color.name,
                            ...commonProps,
                        });
                    });
                } else {
                    // Normal row
                    expandedData.push({
                        code: baseCode,
                        name: baseName,
                        color: row.color || row.COLOR || row.色 ? String(row.color || row.COLOR || row.色) : undefined,
                        ...commonProps,
                    });
                }
            });

            // Filter invalid rows
            const validData = expandedData.filter(row => row.code && row.name);

            setPreviewData(validData);
        };
        reader.readAsBinaryString(file);
    };

    const handleImport = async () => {
        if (previewData.length === 0) return;
        setLoading(true);
        try {
            const result = await importProducts(previewData.map(p => {
                // Auto-calculate prices if missing or 0, based on Cost (unchanged)
                let priceA = p.priceA;
                let priceB = p.priceB;
                const cost = p.cost;

                if ((priceA === 0 || !priceA) && cost > 0) {
                    priceA = Math.ceil(cost * 1.20);
                }
                if ((priceB === 0 || !priceB) && cost > 0) {
                    priceB = Math.ceil(cost * 1.15);
                }

                return {
                    code: p.code,
                    name: p.name,
                    category: p.category,
                    subCategory: p.subCategory,
                    productType: p.productType,
                    priceA: priceA,
                    priceB: priceB,
                    priceC: p.priceC,
                    minStock: p.minStock || 0,
                    cost: p.cost,
                    supplier: p.supplier,
                    color: p.color,
                    unit: p.unit
                };
            }));

            if (result.success) {
                toast.success(`${result.count}件の商品を取り込みました`);
                setOpen(false);
                setPreviewData([]);
            } else {
                toast.error("インポートエラー", {
                    description: result.message,
                    duration: 10000, // Show longer
                });
            }
        } catch (error) {
            toast.error("エラーが発生しました");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            // Clear data when closed
            setPreviewData([]);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Excel一括登録
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[1000px] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Excel一括登録 (Bulk Import)</DialogTitle>
                    <DialogDescription>
                        Excelファイル (.xlsx) を選択してください。エクスポートしたファイルをそのまま利用できます。
                        <br />
                        Columns: code, name, category, subCategory, productType, priceA, priceB, cost...
                        <br />
                        ※`isColor` 列に TRUE を入力した場合のみ、5色展開が生成されます。
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <Input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleFileChange}
                        className="cursor-pointer"
                    />
                </div>

                {previewData.length > 0 && (
                    <div className="flex-1 overflow-hidden border rounded-md">
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>品番</TableHead>
                                        <TableHead>商品名</TableHead>
                                        <TableHead>大カテ</TableHead>
                                        <TableHead>中カテ</TableHead>
                                        <TableHead>小カテ</TableHead>
                                        <TableHead>色</TableHead>
                                        <TableHead className="text-right">売価A</TableHead>
                                        <TableHead className="text-right">売価B</TableHead>
                                        <TableHead className="text-right">売価C</TableHead>
                                        <TableHead className="text-right">仕入</TableHead>
                                        <TableHead>メーカー</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData.map((row) => (
                                        <TableRow key={row.code}>
                                            <TableCell className="font-medium">{row.code}</TableCell>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell>{row.category}</TableCell>
                                            <TableCell>{row.subCategory}</TableCell>
                                            <TableCell>{row.productType || "-"}</TableCell>
                                            <TableCell>{row.color || "-"}</TableCell>
                                            <TableCell className="text-right">{row.priceA}</TableCell>
                                            <TableCell className="text-right">{row.priceB}</TableCell>
                                            <TableCell className="text-right">{row.priceC}</TableCell>
                                            <TableCell className="text-right">{row.cost}</TableCell>
                                            <TableCell>{row.supplier || "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                )}
                {previewData.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground border border-dashed rounded-md">
                        プレビューが表示されます
                    </div>
                )}

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => handleOpenChange(false)}>
                        キャンセル
                    </Button>
                    <Button onClick={handleImport} disabled={loading || previewData.length === 0}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {previewData.length > 0 ? `${previewData.length}件を登録` : "登録"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
