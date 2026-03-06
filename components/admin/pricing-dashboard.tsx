"use client";

import { useState, useTransition } from "react";
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
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { upsertCategoryPricingRule, recalculateCategoryPrices, upsertProduct } from "@/lib/actions";
import { Calculator, AlertTriangle, CheckCircle2, RefreshCw, Pencil, Save, X } from "lucide-react";
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

    // インライン編集
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editCost, setEditCost] = useState("");
    const [editPriceA, setEditPriceA] = useState("");
    const [editPriceB, setEditPriceB] = useState("");
    const [editMode, setEditMode] = useState("");
    const [isPending, startTransition] = useTransition();

    // サマリー統計
    const violations = report.filter(r => r.violation);
    const autoCount = report.filter(r => r.priceMode === "AUTO").length;
    const manualCount = report.filter(r => r.priceMode === "MANUAL").length;
    const markupDiffs = report.filter(r => r.priceMode === "AUTO" && r.diffA !== null && r.diffA !== 0);
    const noCostCount = report.filter(r => r.cost === 0 && r.priceA > 0).length;

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

    // インライン編集開始
    const startEdit = (item: PricingReportItem) => {
        setEditingId(item.id);
        setEditCost(item.cost.toString());
        setEditPriceA(item.priceA.toString());
        setEditPriceB(item.priceB.toString());
        setEditMode(item.priceMode);
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const saveEdit = async (item: PricingReportItem) => {
        startTransition(async () => {
            try {
                await upsertProduct({
                    id: item.id,
                    code: item.code,
                    name: item.name,
                    category: item.category,
                    priceA: parseInt(editPriceA) || 0,
                    priceB: parseInt(editPriceB) || 0,
                    priceC: item.priceC,
                    cost: parseInt(editCost) || 0,
                    minStock: 0,
                    priceMode: editMode,
                });
                toast.success(`${item.code} を更新しました`);
                setEditingId(null);
                router.refresh();
            } catch (e: any) {
                toast.error(e.message);
            }
        });
    };

    // フィルタ適用
    const filteredReport = filter === "all"
        ? report
        : filter === "violations"
            ? violations
            : filter === "manual"
                ? report.filter(r => r.priceMode === "MANUAL")
                : filter === "diff"
                    ? markupDiffs
                    : filter === "noCost"
                        ? report.filter(r => r.cost === 0 && r.priceA > 0)
                        : report.filter(r => r.category === filter);

    return (
        <div className="space-y-6">
            {/* サマリーカード */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("all")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">全商品</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{report.length}</div>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("all")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">AUTO / 手動</CardTitle>
                        <Calculator className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{autoCount}<span className="text-base text-muted-foreground"> / {manualCount}</span></div>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:shadow-md transition-shadow ${violations.length > 0 ? "border-red-300 bg-red-50" : ""}`}
                    onClick={() => setFilter("violations")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">違反</CardTitle>
                        <AlertTriangle className={`h-4 w-4 ${violations.length > 0 ? "text-red-500" : "text-green-500"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${violations.length > 0 ? "text-red-600" : "text-green-600"}`}>
                            {violations.length}
                        </div>
                        <p className="text-xs text-muted-foreground">cost&lt;B&lt;A</p>
                    </CardContent>
                </Card>
                <Card className={`cursor-pointer hover:shadow-md transition-shadow ${markupDiffs.length > 0 ? "border-amber-300 bg-amber-50" : ""}`}
                    onClick={() => setFilter("diff")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">掛率ズレ</CardTitle>
                        <RefreshCw className={`h-4 w-4 ${markupDiffs.length > 0 ? "text-amber-500" : "text-green-500"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${markupDiffs.length > 0 ? "text-amber-600" : "text-green-600"}`}>
                            {markupDiffs.length}
                        </div>
                        <p className="text-xs text-muted-foreground">AUTO商品のみ</p>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("manual")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">手動設定</CardTitle>
                        <Pencil className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{manualCount}</div>
                        <p className="text-xs text-muted-foreground">掛率対象外</p>
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
                                <TableHead className="text-right">掛率A</TableHead>
                                <TableHead className="text-right">掛率B</TableHead>
                                <TableHead className="text-right">AUTO</TableHead>
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
                                        <TableCell className="text-right font-mono">×{rule.markupRateA}</TableCell>
                                        <TableCell className="text-right font-mono">×{rule.markupRateB}</TableCell>
                                        <TableCell className="text-right">{autoProducts.length}件</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex gap-1 justify-center">
                                                <Button variant="outline" size="sm" onClick={() => handleEditRule(rule)}>
                                                    <Pencil className="h-3 w-3 mr-1" /> 編集
                                                </Button>
                                                <Button
                                                    variant="outline" size="sm"
                                                    onClick={() => handleRecalculate(rule.category)}
                                                    disabled={recalculating === rule.category}
                                                >
                                                    <RefreshCw className={`h-3 w-3 mr-1 ${recalculating === rule.category ? "animate-spin" : ""}`} />
                                                    一括適用
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

            {/* 価格レポート（インライン編集対応） */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <CardTitle>価格レポート （{filteredReport.length}件）</CardTitle>
                        <div className="flex gap-1 flex-wrap">
                            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
                                全て
                            </Button>
                            {violations.length > 0 && (
                                <Button size="sm" variant={filter === "violations" ? "destructive" : "outline"}
                                    className={filter !== "violations" ? "text-red-600 border-red-200" : ""}
                                    onClick={() => setFilter("violations")}>
                                    ⚠️違反 ({violations.length})
                                </Button>
                            )}
                            {markupDiffs.length > 0 && (
                                <Button size="sm" variant={filter === "diff" ? "default" : "outline"}
                                    className={filter !== "diff" ? "text-amber-600 border-amber-200" : ""}
                                    onClick={() => setFilter("diff")}>
                                    掛率ズレ ({markupDiffs.length})
                                </Button>
                            )}
                            <Button size="sm" variant={filter === "manual" ? "default" : "outline"}
                                className={filter !== "manual" && manualCount > 0 ? "text-purple-600 border-purple-200" : ""}
                                onClick={() => setFilter("manual")}>
                                手動 ({manualCount})
                            </Button>
                            {noCostCount > 0 && (
                                <Button size="sm" variant={filter === "noCost" ? "default" : "outline"}
                                    onClick={() => setFilter("noCost")}>
                                    仕入未設定 ({noCostCount})
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">コード</TableHead>
                                <TableHead className="hidden lg:table-cell">品名</TableHead>
                                <TableHead>カテゴリ</TableHead>
                                <TableHead className="text-right">仕入値</TableHead>
                                <TableHead className="text-right">売価B</TableHead>
                                <TableHead className="text-right">売価A</TableHead>
                                <TableHead className="text-center">モード</TableHead>
                                <TableHead className="text-center">状態</TableHead>
                                <TableHead className="text-center w-[80px]">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredReport.map(item => {
                                const isEditing = editingId === item.id;
                                return (
                                    <TableRow key={item.id} className={item.violation ? "bg-red-50" : item.diffA && item.priceMode === "AUTO" ? "bg-amber-50/50" : ""}>
                                        <TableCell className="font-mono text-xs">{item.code}</TableCell>
                                        <TableCell className="hidden lg:table-cell max-w-[200px] truncate text-xs">{item.name}</TableCell>
                                        <TableCell className="text-xs">{item.category}</TableCell>

                                        {/* 仕入値 */}
                                        <TableCell className="text-right">
                                            {isEditing ? (
                                                <Input type="number" className="w-20 h-7 text-xs text-right" value={editCost}
                                                    onChange={(e) => setEditCost(e.target.value)} />
                                            ) : (
                                                formatCurrency(item.cost)
                                            )}
                                        </TableCell>

                                        {/* 売価B */}
                                        <TableCell className="text-right">
                                            {isEditing ? (
                                                <Input type="number" className="w-20 h-7 text-xs text-right" value={editPriceB}
                                                    onChange={(e) => setEditPriceB(e.target.value)}
                                                    disabled={editMode === "AUTO"} />
                                            ) : (
                                                <>
                                                    {formatCurrency(item.priceB)}
                                                    {item.diffB !== null && item.diffB !== 0 && item.priceMode === "AUTO" && (
                                                        <span className={`text-[10px] ml-0.5 ${item.diffB > 0 ? "text-green-600" : "text-red-600"}`}>
                                                            ({item.diffB > 0 ? "+" : ""}{item.diffB})
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </TableCell>

                                        {/* 売価A */}
                                        <TableCell className="text-right">
                                            {isEditing ? (
                                                <Input type="number" className="w-20 h-7 text-xs text-right" value={editPriceA}
                                                    onChange={(e) => setEditPriceA(e.target.value)}
                                                    disabled={editMode === "AUTO"} />
                                            ) : (
                                                <>
                                                    {formatCurrency(item.priceA)}
                                                    {item.diffA !== null && item.diffA !== 0 && item.priceMode === "AUTO" && (
                                                        <span className={`text-[10px] ml-0.5 ${item.diffA > 0 ? "text-green-600" : "text-red-600"}`}>
                                                            ({item.diffA > 0 ? "+" : ""}{item.diffA})
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </TableCell>

                                        {/* モード */}
                                        <TableCell className="text-center">
                                            {isEditing ? (
                                                <Select value={editMode} onValueChange={setEditMode}>
                                                    <SelectTrigger className="w-20 h-7 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="AUTO">自動</SelectItem>
                                                        <SelectItem value="MANUAL">手動</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Badge variant={item.priceMode === "MANUAL" ? "default" : "secondary"}
                                                    className={`text-[10px] ${item.priceMode === "MANUAL" ? "bg-purple-600" : ""}`}>
                                                    {item.priceMode === "MANUAL" ? "手動" : "自動"}
                                                </Badge>
                                            )}
                                        </TableCell>

                                        {/* 状態 */}
                                        <TableCell className="text-center">
                                            {item.violation ? (
                                                <span className="text-red-600 text-xs cursor-help" title={item.violation}>⚠️</span>
                                            ) : item.diffA !== null && item.diffA !== 0 && item.priceMode === "AUTO" ? (
                                                <span className="text-amber-500 text-xs cursor-help" title={`掛率計算値との差: ${item.diffA}円`}>△</span>
                                            ) : (
                                                <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                                            )}
                                        </TableCell>

                                        {/* 操作 */}
                                        <TableCell className="text-center">
                                            {isEditing ? (
                                                <div className="flex gap-0.5 justify-center">
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600"
                                                        onClick={() => saveEdit(item)} disabled={isPending}>
                                                        <Save className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400"
                                                        onClick={cancelEdit}>
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(item)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    {filteredReport.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-8">該当する商品はありません</p>
                    )}
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
                            <Input type="number" step="0.01" value={rateA}
                                onChange={(e) => setRateA(e.target.value)} placeholder="例: 1.20" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">掛率B（特価）</label>
                            <p className="text-xs text-muted-foreground mb-1">priceB = cost × 掛率B（必ず掛率Aより小さく）</p>
                            <Input type="number" step="0.01" value={rateB}
                                onChange={(e) => setRateB(e.target.value)} placeholder="例: 1.10" />
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
                        <Button onClick={handleSaveRule}
                            disabled={saving || !rateA || !rateB || parseFloat(rateB) >= parseFloat(rateA)}>
                            {saving ? "保存中..." : "保存"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
