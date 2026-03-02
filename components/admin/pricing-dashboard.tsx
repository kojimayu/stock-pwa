"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { upsertCategoryPricingRule, recalculateCategoryPrices } from "@/lib/actions";
import { Calculator, AlertTriangle, CheckCircle2, RefreshCw, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type PricingRule = {
    id: number;
    category: string;
    markupRateA: number;
    markupRateB: number;
};

type PricingReportItem = {
    id: number;
    code: string;
    name: string;
    category: string;
    priceA: number;
    priceB: number;
    priceC: number;
    cost: number;
    priceMode: string;
    markupRateA: number | null;
    markupRateB: number | null;
    expectedA: number | null;
    expectedB: number | null;
    diffA: number | null;
    diffB: number | null;
    violation: string | null;
};

type Props = {
    rules: PricingRule[];
    report: PricingReportItem[];
};

export function PricingDashboard({ rules, report }: Props) {
    const router = useRouter();
    const [editRule, setEditRule] = useState<PricingRule | null>(null);
    const [rateA, setRateA] = useState("");
    const [rateB, setRateB] = useState("");
    const [saving, setSaving] = useState(false);
    const [recalculating, setRecalculating] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>("all");

    // サマリー統計
    const violations = report.filter(r => r.violation);
    const manualCount = report.filter(r => r.priceMode === "MANUAL").length;
    const autoCount = report.filter(r => r.priceMode === "AUTO").length;
    const withDiff = report.filter(r => r.diffA !== null && r.diffA !== 0);

    const handleEditRule = (rule: PricingRule) => {
        setEditRule(rule);
        setRateA(rule.markupRateA.toString());
        setRateB(rule.markupRateB.toString());
    };

    const handleSaveRule = async () => {
        if (!editRule) return;
        setSaving(true);
        try {
            await upsertCategoryPricingRule(editRule.category, parseFloat(rateA), parseFloat(rateB));
            toast.success(`${editRule.category}の掛率を更新しました`);
            setEditRule(null);
            router.refresh();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRecalculate = async (category: string) => {
        setRecalculating(category);
        try {
            const result = await recalculateCategoryPrices(category);
            toast.success(`${category}: ${result.updated}件の価格を再計算しました`);
            router.refresh();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setRecalculating(null);
        }
    };

    // フィルタ適用
    const filteredReport = filter === "all"
        ? report
        : filter === "violations"
            ? violations
            : filter === "manual"
                ? report.filter(r => r.priceMode === "MANUAL")
                : filter === "diff"
                    ? withDiff
                    : report.filter(r => r.category === filter);

    return (
        <div className="space-y-6">
            {/* サマリーカード */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">AUTO商品</CardTitle>
                        <Calculator className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{autoCount}件</div>
                        <p className="text-xs text-muted-foreground">掛率で自動計算</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">MANUAL商品</CardTitle>
                        <Pencil className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{manualCount}件</div>
                        <p className="text-xs text-muted-foreground">手動設定</p>
                    </CardContent>
                </Card>
                <Card className={violations.length > 0 ? "border-red-300 bg-red-50" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">セーフガード違反</CardTitle>
                        <AlertTriangle className={`h-4 w-4 ${violations.length > 0 ? "text-red-500" : "text-green-500"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${violations.length > 0 ? "text-red-600" : "text-green-600"}`}>
                            {violations.length}件
                        </div>
                        <p className="text-xs text-muted-foreground">cost &lt; B &lt; A チェック</p>
                    </CardContent>
                </Card>
                <Card className={withDiff.length > 0 ? "border-amber-300 bg-amber-50" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">掛率ズレ</CardTitle>
                        <RefreshCw className={`h-4 w-4 ${withDiff.length > 0 ? "text-amber-500" : "text-green-500"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${withDiff.length > 0 ? "text-amber-600" : "text-green-600"}`}>
                            {withDiff.length}件
                        </div>
                        <p className="text-xs text-muted-foreground">掛率計算値と実値のズレ</p>
                    </CardContent>
                </Card>
            </div>

            {/* カテゴリ掛率テーブル */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        カテゴリ別掛率
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>カテゴリ</TableHead>
                                <TableHead className="text-right">掛率A（通常）</TableHead>
                                <TableHead className="text-right">掛率B（特価）</TableHead>
                                <TableHead className="text-right">AUTO商品</TableHead>
                                <TableHead className="text-center">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rules.map(rule => {
                                const categoryProducts = report.filter(r => r.category === rule.category);
                                const autoProducts = categoryProducts.filter(r => r.priceMode === "AUTO");
                                return (
                                    <TableRow key={rule.id}>
                                        <TableCell className="font-medium">{rule.category}</TableCell>
                                        <TableCell className="text-right">×{rule.markupRateA}</TableCell>
                                        <TableCell className="text-right">×{rule.markupRateB}</TableCell>
                                        <TableCell className="text-right">{autoProducts.length}件</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex gap-1 justify-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEditRule(rule)}
                                                >
                                                    <Pencil className="h-3 w-3 mr-1" /> 編集
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleRecalculate(rule.category)}
                                                    disabled={recalculating === rule.category}
                                                >
                                                    <RefreshCw className={`h-3 w-3 mr-1 ${recalculating === rule.category ? "animate-spin" : ""}`} />
                                                    適用
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* 価格レポート */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <CardTitle>価格レポート</CardTitle>
                        <div className="flex gap-1 flex-wrap">
                            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
                                全て ({report.length})
                            </Button>
                            {violations.length > 0 && (
                                <Button size="sm" variant={filter === "violations" ? "destructive" : "outline"}
                                    className={filter !== "violations" ? "text-red-600 border-red-200" : ""}
                                    onClick={() => setFilter("violations")}>
                                    ⚠️ 違反 ({violations.length})
                                </Button>
                            )}
                            {withDiff.length > 0 && (
                                <Button size="sm" variant={filter === "diff" ? "default" : "outline"}
                                    className={filter !== "diff" ? "text-amber-600 border-amber-200" : ""}
                                    onClick={() => setFilter("diff")}>
                                    掛率ズレ ({withDiff.length})
                                </Button>
                            )}
                            <Button size="sm" variant={filter === "manual" ? "default" : "outline"} onClick={() => setFilter("manual")}>
                                手動 ({manualCount})
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>コード</TableHead>
                                <TableHead className="hidden md:table-cell">品名</TableHead>
                                <TableHead>カテゴリ</TableHead>
                                <TableHead className="text-right">仕入値</TableHead>
                                <TableHead className="text-right">売価A</TableHead>
                                <TableHead className="text-right hidden sm:table-cell">売価B</TableHead>
                                <TableHead className="text-center">モード</TableHead>
                                <TableHead className="text-center">状態</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredReport.map(item => (
                                <TableRow key={item.id} className={item.violation ? "bg-red-50" : item.diffA ? "bg-amber-50/50" : ""}>
                                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                                    <TableCell className="hidden md:table-cell max-w-[200px] truncate">{item.name}</TableCell>
                                    <TableCell className="text-xs">{item.category}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                                    <TableCell className="text-right">
                                        {formatCurrency(item.priceA)}
                                        {item.diffA !== null && item.diffA !== 0 && (
                                            <span className={`text-xs ml-1 ${item.diffA > 0 ? "text-green-600" : "text-red-600"}`}>
                                                ({item.diffA > 0 ? "+" : ""}{item.diffA})
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right hidden sm:table-cell">{formatCurrency(item.priceB)}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={item.priceMode === "MANUAL" ? "default" : "secondary"}
                                            className={item.priceMode === "MANUAL" ? "bg-purple-600" : ""}>
                                            {item.priceMode === "MANUAL" ? "手動" : "自動"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {item.violation ? (
                                            <span className="text-red-600 text-xs" title={item.violation}>⚠️</span>
                                        ) : item.diffA !== null && item.diffA !== 0 ? (
                                            <span className="text-amber-500 text-xs" title={`掛率計算値との差: ${item.diffA}`}>△</span>
                                        ) : (
                                            <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* 掛率編集ダイアログ */}
            <Dialog open={!!editRule} onOpenChange={(open) => !open && setEditRule(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>掛率編集: {editRule?.category}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium">掛率A（通常価格）</label>
                            <p className="text-xs text-muted-foreground mb-1">priceA = cost × 掛率A</p>
                            <Input
                                type="number"
                                step="0.01"
                                value={rateA}
                                onChange={(e) => setRateA(e.target.value)}
                                placeholder="例: 1.20"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">掛率B（特価）</label>
                            <p className="text-xs text-muted-foreground mb-1">priceB = cost × 掛率B（必ず掛率Aより小さく）</p>
                            <Input
                                type="number"
                                step="0.01"
                                value={rateB}
                                onChange={(e) => setRateB(e.target.value)}
                                placeholder="例: 1.10"
                            />
                        </div>
                        {rateA && rateB && parseFloat(rateB) >= parseFloat(rateA) && (
                            <div className="text-red-600 text-sm flex items-center gap-1">
                                <AlertTriangle className="h-4 w-4" />
                                掛率Bは掛率Aより小さくしてください
                            </div>
                        )}
                        <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                            <p className="font-medium mb-1">プレビュー（cost=1000の場合）:</p>
                            <p>priceA = {rateA ? Math.ceil(1000 * parseFloat(rateA)) : "-"}円</p>
                            <p>priceB = {rateB ? Math.ceil(1000 * parseFloat(rateB)) : "-"}円</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditRule(null)}>キャンセル</Button>
                        <Button
                            onClick={handleSaveRule}
                            disabled={saving || !rateA || !rateB || parseFloat(rateB) >= parseFloat(rateA)}
                        >
                            {saving ? "保存中..." : "保存"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
