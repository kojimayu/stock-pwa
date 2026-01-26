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
    priceA: number;
    priceB: number;
    minStock?: number;
    cost: number;
    supplier?: string;
    color?: string;
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
        { name: "アイボリー", suffix: "-IV" },
        { name: "ブラウン", suffix: "-BN" },
        { name: "ブラック", suffix: "-BK" },
        { name: "ホワイト", suffix: "-WH" },
        { name: "グレー", suffix: "-GY" },
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
                const rawCode = String(row.code || row.CODE || row.型番 || row["商品コード"] || "");
                const baseName = String(row.name || row.NAME || row.品名 || row.商品名 || "");
                const baseCode = normalizeCode(rawCode);

                const commonProps = {
                    category: String(row.category || row.CATEGORY || row.カテゴリ || ""),
                    priceA: Number(row.priceA || row.PRICEA || row.売価A || row.定価 || 0),
                    priceB: Number(row.priceB || row.PRICEB || row.売価B || row.特価 || 0),
                    minStock: row.minStock || row.MINSTOCK || row.下限在庫 ? Number(row.minStock || row.MINSTOCK || row.下限在庫) : 0,
                    cost: Number(row.cost || row.COST || row.原価 || row.仕入単価 || 0),
                    supplier: row.supplier || row.SUPPLIER || row.仕入先 || row.メーカー ? String(row.supplier || row.SUPPLIER || row.仕入先 || row.メーカー) : undefined,
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
            const result = await importProducts(previewData.map(p => ({
                code: p.code,
                name: p.name,
                category: p.category,
                priceA: p.priceA,
                priceB: p.priceB,
                minStock: p.minStock || 0,
                cost: p.cost,
                supplier: p.supplier,
                color: p.color
            })));

            if (result.success) {
                toast.success(`${result.count}件の商品を取り込みました`);
                setOpen(false);
                setPreviewData([]);
            } else {
                toast.error(result.message || "インポートに失敗しました");
            }
        } catch (error) {
            toast.error("エラーが発生しました");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Excel一括登録
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Excel一括登録 (Bulk Import)</DialogTitle>
                    <DialogDescription>
                        Excelファイル (.xlsx) を選択してください。
                        <br />
                        必須: code, name, category, priceA, priceB, cost
                        <br />
                        ※`isColor` (または `色展開`) 列に 1 を入力すると、指定の5色に自動展開されます。
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
                                        <TableHead>Code</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Color</TableHead>
                                        <TableHead>Cat.</TableHead>
                                        <TableHead className="text-right">Price A</TableHead>
                                        <TableHead className="text-right">Price B</TableHead>
                                        <TableHead className="text-right">Cost</TableHead>
                                        <TableHead>Supplier</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData.map((row) => (
                                        <TableRow key={row.code}>
                                            <TableCell className="font-medium">{row.code}</TableCell>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell>{row.color || "-"}</TableCell>
                                            <TableCell>{row.category}</TableCell>
                                            <TableCell className="text-right">{row.priceA}</TableCell>
                                            <TableCell className="text-right">{row.priceB}</TableCell>
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
                    <Button variant="outline" onClick={() => setOpen(false)}>
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
