"use client";

import { useState, useEffect } from "react";
import { getDiscrepancyReport } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ChevronLeft, TrendingDown, BarChart3, Loader2, AlertTriangle, Percent } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

type ReportData = Awaited<ReturnType<typeof getDiscrepancyReport>>;

export function DiscrepancyReportView() {
    const router = useRouter();
    const [months, setMonths] = useState(3);
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getDiscrepancyReport(months)
            .then(setReport)
            .finally(() => setLoading(false));
    }, [months]);

    return (
        <div className="space-y-6">
            {/* ヘッダー */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => router.push("/admin/inventory")}>
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        棚卸管理
                    </Button>
                    <h1 className="text-2xl font-bold">在庫差異分析レポート</h1>
                </div>
                <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
                    <SelectTrigger className="w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">過去1ヶ月</SelectItem>
                        <SelectItem value="3">過去3ヶ月</SelectItem>
                        <SelectItem value="6">過去6ヶ月</SelectItem>
                        <SelectItem value="12">過去12ヶ月</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : !report ? (
                <div className="text-center py-20 text-muted-foreground">データの取得に失敗しました</div>
            ) : (
                <>
                    {/* サマリーカード */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">差異件数 / 棚卸総数</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {report.summary.totalDiscrepancies}
                                    <span className="text-sm font-normal text-muted-foreground"> / {report.summary.totalInventoryItems}</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-red-200 bg-red-50/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-red-600">
                                    実損（紛失・破損）
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-700">
                                    {formatCurrency(report.summary.realLoss)}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-amber-200 bg-amber-50/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-amber-600">
                                    原因判明分
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-amber-700">
                                    {formatCurrency(report.summary.resolvedLoss)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">数え間違い・記録漏れ等</div>
                            </CardContent>
                        </Card>
                        <Card className="border-blue-200 bg-blue-50/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-blue-600">過剰金額</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-700">
                                    {formatCurrency(report.summary.totalExcessAmount)}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* データなしの場合 */}
                    {report.summary.totalDiscrepancies === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium">差異データがありません</p>
                                <p className="text-sm mt-1">棚卸（一斉・スポット）で差異が確定されるとここに表示されます</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* 実損TOP / 差異発生率TOP */}
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* 実損金額TOP */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-red-700">
                                            <TrendingDown className="w-5 h-5" />
                                            実損金額TOP（紛失・破損のみ）
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {report.lossTop.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">実損データなし（紛失・破損の理由がある差異のみ対象）</p>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>商品</TableHead>
                                                        <TableHead className="text-right">実損金額</TableHead>
                                                        <TableHead className="text-right">差異率</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {report.lossTop.map((item) => (
                                                        <TableRow key={item.productId}>
                                                            <TableCell>
                                                                <div className="font-medium">{item.productName}</div>
                                                                <div className="text-xs text-muted-foreground">{item.category}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right text-red-600 font-bold">
                                                                {formatCurrency(item.realLossAmount)}
                                                            </TableCell>
                                                            <TableCell className="text-right text-muted-foreground text-sm">
                                                                {item.discrepancyCount}/{item.totalInventoryCount}回
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* 差異発生率TOP */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-amber-700">
                                            <Percent className="w-5 h-5" />
                                            差異発生率TOP（2回以上棚卸）
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {report.rateTop.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">2回以上棚卸された商品がまだありません</p>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>商品</TableHead>
                                                        <TableHead className="text-right">発生率</TableHead>
                                                        <TableHead className="text-right">ネット差異</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {report.rateTop.map((item) => (
                                                        <TableRow key={item.productId}>
                                                            <TableCell>
                                                                <div className="font-medium">{item.productName}</div>
                                                                <div className="text-xs text-muted-foreground">{item.category}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <span className="font-bold text-amber-600">
                                                                    {(item.discrepancyRate * 100).toFixed(0)}%
                                                                </span>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {item.discrepancyCount}/{item.totalInventoryCount}回
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className={`text-right font-bold ${item.netAdjustment < 0 ? 'text-red-600' : item.netAdjustment > 0 ? 'text-blue-600' : ''}`}>
                                                                {item.netAdjustment > 0 ? '+' : ''}{item.netAdjustment}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* 理由別集計 */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                                        理由別集計
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {report.reasonBreakdown.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">理由データなし</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {report.reasonBreakdown.map((item) => {
                                                const maxLoss = report.reasonBreakdown[0]?.lossAmount || 1;
                                                const percentage = maxLoss > 0 ? (item.lossAmount / maxLoss) * 100 : 0;
                                                return (
                                                    <div key={item.reason} className="space-y-1">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="font-medium">
                                                                {item.reason}
                                                                {item.isRealLoss && (
                                                                    <span className="ml-2 text-xs text-red-500 font-bold">実損</span>
                                                                )}
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                {item.count}件 / {formatCurrency(item.lossAmount)}
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-2.5">
                                                            <div
                                                                className={`h-2.5 rounded-full transition-all ${item.isRealLoss ? 'bg-red-500' : 'bg-amber-400'}`}
                                                                style={{ width: `${Math.max(percentage, 2)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* カテゴリ別ロス（実損のみ） */}
                            {report.categoryBreakdown.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <BarChart3 className="w-5 h-5 text-slate-600" />
                                            カテゴリ別実損（紛失・破損のみ）
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>カテゴリ</TableHead>
                                                    <TableHead className="text-right">不足数量</TableHead>
                                                    <TableHead className="text-right">実損金額</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {report.categoryBreakdown.map((cat) => (
                                                    <TableRow key={cat.category}>
                                                        <TableCell className="font-medium">{cat.category}</TableCell>
                                                        <TableCell className="text-right">{cat.shortageCount}</TableCell>
                                                        <TableCell className="text-right text-red-600 font-bold">
                                                            {formatCurrency(cat.lossAmount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
