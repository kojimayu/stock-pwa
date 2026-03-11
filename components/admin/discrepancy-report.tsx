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
import { ChevronLeft, TrendingDown, TrendingUp, AlertTriangle, BarChart3, Loader2 } from "lucide-react";
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
                                <CardTitle className="text-sm font-medium text-muted-foreground">差異件数</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{report.summary.totalDiscrepancies}件</div>
                            </CardContent>
                        </Card>
                        <Card className="border-red-200 bg-red-50/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-red-600">推定ロス金額</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-700">
                                    {formatCurrency(report.summary.totalLoss)}
                                </div>
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
                        <Card className={`border-${report.summary.netLoss > 0 ? 'red' : 'green'}-200`}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">純損失</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${report.summary.netLoss > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                    {report.summary.netLoss > 0 ? '-' : '+'}{formatCurrency(Math.abs(report.summary.netLoss))}
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
                            {/* 不足TOP / 過剰TOP */}
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* 不足TOP */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-red-700">
                                            <TrendingDown className="w-5 h-5" />
                                            不足TOP{report.shortageTop.length}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {report.shortageTop.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">不足データなし</p>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>商品</TableHead>
                                                        <TableHead className="text-right">不足数</TableHead>
                                                        <TableHead className="text-right">ロス金額</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {report.shortageTop.map((item) => (
                                                        <TableRow key={item.productId}>
                                                            <TableCell>
                                                                <div className="font-medium">{item.productName}</div>
                                                                <div className="text-xs text-muted-foreground">{item.category}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right text-red-600 font-bold">
                                                                {item.totalShortage}
                                                            </TableCell>
                                                            <TableCell className="text-right text-red-600">
                                                                {formatCurrency(item.lossAmount)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* 過剰TOP */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-blue-700">
                                            <TrendingUp className="w-5 h-5" />
                                            過剰TOP{report.excessTop.length}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {report.excessTop.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">過剰データなし</p>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>商品</TableHead>
                                                        <TableHead className="text-right">過剰数</TableHead>
                                                        <TableHead className="text-right">回数</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {report.excessTop.map((item) => (
                                                        <TableRow key={item.productId}>
                                                            <TableCell>
                                                                <div className="font-medium">{item.productName}</div>
                                                                <div className="text-xs text-muted-foreground">{item.category}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right text-blue-600 font-bold">
                                                                +{item.totalExcess}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {item.count}回
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
                                                            <span className="font-medium">{item.reason}</span>
                                                            <span className="text-muted-foreground">
                                                                {item.count}件 / {formatCurrency(item.lossAmount)}
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-2.5">
                                                            <div
                                                                className="bg-amber-500 h-2.5 rounded-full transition-all"
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

                            {/* カテゴリ別ロス */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-slate-600" />
                                        カテゴリ別ロス
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {report.categoryBreakdown.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">カテゴリ別データなし</p>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>カテゴリ</TableHead>
                                                    <TableHead className="text-right">不足数量</TableHead>
                                                    <TableHead className="text-right">ロス金額</TableHead>
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
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
