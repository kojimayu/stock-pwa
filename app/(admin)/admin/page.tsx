import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Package, ArrowUpRight, Fan, ClipboardList, AlertTriangle } from "lucide-react";
import { getDashboardStats, getRecentTransactions } from "@/lib/actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

async function getAirconStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayAirconLogs, pendingAirconOrders, recentAirconLogs, lowStockAircon] = await Promise.all([
        // 本日のエアコン持出し数
        prisma.airConditionerLog.count({
            where: { createdAt: { gte: today } }
        }),
        // 未完了のエアコン発注
        prisma.airconOrder.findMany({
            where: { status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } },
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: "desc" }
        }),
        // 最近のエアコン持出し(5件)
        prisma.airConditionerLog.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { vendor: true }
        }),
        // 在庫アラート
        prisma.airconProduct.findMany({
            where: { stock: { lte: prisma.airconProduct.fields.minStock } }
        })
    ]);

    return { todayAirconLogs, pendingAirconOrders, recentAirconLogs, lowStockAircon };
}

const orderStatusLabel: Record<string, string> = {
    DRAFT: "下書き",
    ORDERED: "発注済",
    PARTIAL: "一部入荷",
    RECEIVED: "完了",
    CANCELLED: "キャンセル",
};

export default async function AdminDashboardPage() {
    const stats = await getDashboardStats();
    const recentTransactions = await getRecentTransactions(5);
    const airconStats = await getAirconStats();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">ダッシュボード</h2>
                <p className="text-muted-foreground">システムの概要と最近の活動状況</p>
            </div>

            {/* 統計カード */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">材料 総在庫数</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalStock.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">部材の総在庫点数</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">本日の材料取引</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.todayTransactions}</div>
                        <p className="text-xs text-muted-foreground">本日の取引件数</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">本日のエアコン持出し</CardTitle>
                        <Fan className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{airconStats.todayAirconLogs}</div>
                        <p className="text-xs text-muted-foreground">本日の持出し件数</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">累計取引</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalTransactions}</div>
                        <p className="text-xs text-muted-foreground">材料取引の累計</p>
                    </CardContent>
                </Card>
            </div>

            {/* 発注状況アラート */}
            {airconStats.pendingAirconOrders.length > 0 && (
                <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-blue-800 flex items-center gap-2">
                            <ClipboardList className="w-5 h-5" />
                            処理待ちエアコン発注
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {airconStats.pendingAirconOrders.slice(0, 3).map((order: any) => (
                                <div key={order.id} className="flex items-center justify-between bg-white p-2 rounded">
                                    <span>
                                        発注 #{order.id}
                                        <Badge className="ml-2" variant="outline">
                                            {orderStatusLabel[order.status]}
                                        </Badge>
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {order.items.map((i: any) => `${i.product.code} ×${i.quantity}`).join(", ")}
                                    </span>
                                </div>
                            ))}
                            <Link href="/admin/aircon-orders" className="text-sm text-blue-600 hover:underline block mt-2">
                                すべて表示 →
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* コンテンツグリッド */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* 最近の材料取引 */}
                <Card>
                    <CardHeader>
                        <CardTitle>最近の材料取引</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentTransactions.length === 0 ? (
                            <div className="text-sm text-slate-500 text-center py-8">
                                データがありません
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>日時</TableHead>
                                        <TableHead>業者名</TableHead>
                                        <TableHead className="text-right">金額</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentTransactions.map((tx) => (
                                        <TableRow key={tx.id}>
                                            <TableCell className="text-sm">{formatDate(tx.date)}</TableCell>
                                            <TableCell>{tx.vendor.name}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(tx.totalAmount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        <Link href="/admin/transactions" className="text-sm text-blue-600 hover:underline block mt-3">
                            すべて表示 →
                        </Link>
                    </CardContent>
                </Card>

                {/* 最近のエアコン持出し */}
                <Card>
                    <CardHeader>
                        <CardTitle>最近のエアコン持出し</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {airconStats.recentAirconLogs.length === 0 ? (
                            <div className="text-sm text-slate-500 text-center py-8">
                                データがありません
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>日時</TableHead>
                                        <TableHead>業者名</TableHead>
                                        <TableHead>品番</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {airconStats.recentAirconLogs.map((log: any) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-sm">{formatDate(log.createdAt)}</TableCell>
                                            <TableCell>{log.vendor.name}</TableCell>
                                            <TableCell className="font-mono text-sm">{log.modelNumber}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        <Link href="/admin/aircon-logs" className="text-sm text-blue-600 hover:underline block mt-3">
                            すべて表示 →
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
