import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Package, ArrowUpRight, ArrowDownRight, FileText } from "lucide-react";
import { getDashboardStats, getRecentTransactions } from "@/lib/actions";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function AdminDashboardPage() {
    const stats = await getDashboardStats();
    const recentTransactions = await getRecentTransactions(5);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">ダッシュボード</h2>
                <p className="text-muted-foreground">システムの概要と最近の活動状況</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">総在庫数</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalStock.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Total items in stock
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">本日の取引数</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.todayTransactions}</div>
                        <p className="text-xs text-muted-foreground">
                            Transactions today
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">累計取引数</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalTransactions}</div>
                        <p className="text-xs text-muted-foreground">
                            Total transactions
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-7">
                <Card className="col-span-7">
                    <CardHeader>
                        <CardTitle>最近の取引</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentTransactions.length === 0 ? (
                            <div className="text-sm text-slate-500 text-center py-10">
                                データがありません
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>日時</TableHead>
                                        <TableHead>業者名</TableHead>
                                        <TableHead>商品数</TableHead>
                                        <TableHead className="text-right">合計金額</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentTransactions.map((tx) => {
                                        let itemCount = 0;
                                        try {
                                            const items = JSON.parse(tx.items);
                                            // items は配列か、あるいは配列を含むオブジェクトかを想定
                                            // ここでは items: [{ productId, quantity, price }] の配列と仮定
                                            if (Array.isArray(items)) {
                                                itemCount = items.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0);
                                            }
                                        } catch (e) {
                                            console.error("Failed to parse items", e);
                                        }

                                        return (
                                            <TableRow key={tx.id}>
                                                <TableCell>{formatDate(tx.date)}</TableCell>
                                                <TableCell>{tx.vendor.name}</TableCell>
                                                <TableCell>{itemCount} 点</TableCell>
                                                <TableCell className="text-right">{formatCurrency(tx.totalAmount)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
