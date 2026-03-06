import { getAnalysisData } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, TrendingUp, DollarSign, Package } from "lucide-react";

export default async function AnalysisPage() {
    const data = await getAnalysisData();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">利益分析 (Profit Analysis)</h1>
                <p className="text-muted-foreground">在庫資産の価値と利益率の健全性を分析します。</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">在庫資産総額 (原価)</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalCost)}</div>
                        <p className="text-xs text-muted-foreground">仕入れコストの合計</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">在庫資産総額 (売価)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalSalesValue)}</div>
                        <p className="text-xs text-muted-foreground">すべて販売できた場合の売上</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">潜在利益 (概算)</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(data.potentialProfit)}</div>
                        <p className="text-xs text-muted-foreground">
                            平均利益率: {data.totalSalesValue > 0 ? ((data.potentialProfit / data.totalSalesValue) * 100).toFixed(1) : 0}%
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold flex items-center">
                    <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
                    低利益率商品 (利益率 10%未満)
                </h2>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>商品ID</TableHead>
                                <TableHead>商品名</TableHead>
                                <TableHead>カテゴリ</TableHead>
                                <TableHead className="text-right">原価</TableHead>
                                <TableHead className="text-right">売価A</TableHead>
                                <TableHead className="text-right">利益率</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.lowMarginProducts.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-mono">{product.code}</TableCell>
                                    <TableCell>{product.name}</TableCell>
                                    <TableCell>{product.category}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(product.cost)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(product.priceA)}</TableCell>
                                    <TableCell className="text-right text-red-600 font-bold">
                                        {product.margin.toFixed(1)}%
                                    </TableCell>
                                </TableRow>
                            ))}
                            {data.lowMarginProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        利益率の低い商品はありません。健全です！
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
