import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Fan, ClipboardList, AlertTriangle, ShoppingCart, TrendingDown } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// 材料の発注アラート情報を取得
// 材料の発注アラート情報を取得
// 材料の発注アラート情報を取得
async function getLowStockMaterials() {
    // 1. 最低在庫設定がある商品をすべて取得
    // ※Prismaで「カラム同士の比較(stock < minStock)」は直接できないため、JS側でフィルタリングする
    const candidates = await prisma.product.findMany({
        where: {
            minStock: { gt: 0 }
        },
        include: {
            // 発注済みチェック用: ORDEREDかPARTIALの注文が含まれているか
            orderItems: {
                where: {
                    order: {
                        status: { in: ["ORDERED", "PARTIAL"] }
                    }
                },
                select: { id: true } // 存在確認だけで良いのでIDのみ取得
            }
        },
        orderBy: [
            { stock: 'asc' },
            { name: 'asc' }
        ]
    });

    // 2. フィルタリング (在庫切れ or 最低在庫未満 どちらも対象)
    // ・在庫 < 最低在庫
    // ・かつ、発注済み(orderItems)がない
    const lowStockProducts = candidates.filter(p =>
        p.stock < p.minStock && p.orderItems.length === 0
    );

    // 3. 表示上限
    return lowStockProducts.slice(0, 20);
}

// エアコン関連の統計を取得
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
        // エアコン在庫アラート
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
    const [lowStockMaterials, airconStats] = await Promise.all([
        getLowStockMaterials(),
        getAirconStats()
    ]);

    // 発注が必要な材料（在庫0）
    const criticalMaterials = lowStockMaterials.filter(p => p.stock === 0);
    // 在庫が少ない材料（在庫 > 0 だが minStock 未満）
    const warningMaterials = lowStockMaterials.filter(p => p.stock > 0);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">ダッシュボード</h2>
                <p className="text-muted-foreground">在庫状況と発注アラート</p>
            </div>

            {/* 統計カード */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* 発注必要（在庫ゼロ） */}
                <Card className={criticalMaterials.length > 0 ? "border-red-300 bg-red-50" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">発注必要（在庫切れ）</CardTitle>
                        <AlertTriangle className={`h-4 w-4 ${criticalMaterials.length > 0 ? "text-red-600" : "text-muted-foreground"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${criticalMaterials.length > 0 ? "text-red-600" : ""}`}>
                            {criticalMaterials.length}
                        </div>
                        <p className="text-xs text-muted-foreground">在庫ゼロの材料</p>
                    </CardContent>
                </Card>

                {/* 在庫注意 */}
                <Card className={warningMaterials.length > 0 ? "border-amber-300 bg-amber-50" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">在庫注意</CardTitle>
                        <TrendingDown className={`h-4 w-4 ${warningMaterials.length > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${warningMaterials.length > 0 ? "text-amber-600" : ""}`}>
                            {warningMaterials.length}
                        </div>
                        <p className="text-xs text-muted-foreground">最低在庫未満の材料</p>
                    </CardContent>
                </Card>

                {/* 本日のエアコン持出し */}
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

                {/* 処理待ちエアコン発注 */}
                <Card className={airconStats.pendingAirconOrders.length > 0 ? "border-blue-200 bg-blue-50" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">処理待ち発注</CardTitle>
                        <ClipboardList className={`h-4 w-4 ${airconStats.pendingAirconOrders.length > 0 ? "text-blue-600" : "text-muted-foreground"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${airconStats.pendingAirconOrders.length > 0 ? "text-blue-600" : ""}`}>
                            {airconStats.pendingAirconOrders.length}
                        </div>
                        <p className="text-xs text-muted-foreground">エアコン発注</p>
                    </CardContent>
                </Card>
            </div>

            {/* 発注が必要な材料リスト（在庫ゼロ） */}
            {criticalMaterials.length > 0 && (
                <Card className="border-red-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            発注が必要な材料（在庫切れ）
                        </CardTitle>
                        <CardDescription>在庫がゼロになっている材料です。早急に発注してください。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">品番</TableHead>
                                    <TableHead>商品名</TableHead>
                                    <TableHead>カテゴリ</TableHead>
                                    <TableHead className="text-right">在庫</TableHead>
                                    <TableHead className="text-right">最低在庫</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {criticalMaterials.slice(0, 10).map((product) => (
                                    <TableRow key={product.id} className="bg-red-50/50">
                                        <TableCell className="font-mono text-sm">{product.code}</TableCell>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {product.category}
                                            {product.subCategory && ` / ${product.subCategory}`}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-red-600">0</TableCell>
                                        <TableCell className="text-right text-muted-foreground">{product.minStock}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {criticalMaterials.length > 10 && (
                            <p className="text-sm text-muted-foreground mt-2">
                                他 {criticalMaterials.length - 10} 件
                            </p>
                        )}
                        <div className="mt-4">
                            <Link href="/admin/orders">
                                <Button variant="destructive" size="sm">
                                    <ShoppingCart className="w-4 h-4 mr-2" />
                                    発注管理へ
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 在庫注意の材料リスト */}
            {warningMaterials.length > 0 && (
                <Card className="border-amber-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-amber-700 flex items-center gap-2">
                            <TrendingDown className="w-5 h-5" />
                            在庫が少なくなっている材料
                        </CardTitle>
                        <CardDescription>在庫が最低在庫数未満の材料です。発注を検討してください。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">品番</TableHead>
                                    <TableHead>商品名</TableHead>
                                    <TableHead>カテゴリ</TableHead>
                                    <TableHead className="text-right">在庫</TableHead>
                                    <TableHead className="text-right">最低在庫</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {warningMaterials.slice(0, 10).map((product) => (
                                    <TableRow key={product.id} className="bg-amber-50/50">
                                        <TableCell className="font-mono text-sm">{product.code}</TableCell>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {product.category}
                                            {product.subCategory && ` / ${product.subCategory}`}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-amber-600">{product.stock}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">{product.minStock}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {warningMaterials.length > 10 && (
                            <p className="text-sm text-muted-foreground mt-2">
                                他 {warningMaterials.length - 10} 件
                            </p>
                        )}
                        <div className="mt-4">
                            <Link href="/admin/products">
                                <Button variant="outline" size="sm">
                                    <Package className="w-4 h-4 mr-2" />
                                    商品管理へ
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 在庫問題なしの場合 */}
            {criticalMaterials.length === 0 && warningMaterials.length === 0 && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="py-8 text-center">
                        <Package className="w-12 h-12 mx-auto text-green-600 mb-3" />
                        <p className="text-green-700 font-medium">すべての材料の在庫が十分です</p>
                        <p className="text-sm text-green-600 mt-1">発注が必要な材料はありません</p>
                    </CardContent>
                </Card>
            )}

            {/* エアコン発注状況 */}
            {airconStats.pendingAirconOrders.length > 0 && (
                <Card className="border-blue-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-blue-800 flex items-center gap-2">
                            <ClipboardList className="w-5 h-5" />
                            処理待ちエアコン発注
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {airconStats.pendingAirconOrders.slice(0, 3).map((order: any) => (
                                <div key={order.id} className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                                    <span className="font-medium">
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
                            <TableBody >
                                {
                                    airconStats.recentAirconLogs.map((log: any) => (
                                        <TableRow key={log.id} className={log.isReturned ? "bg-red-50 hover:bg-red-100" : ""}>
                                            <TableCell className="text-sm">
                                                {formatDate(log.createdAt)}
                                                {log.isReturned && (
                                                    <span className="ml-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded inline-block">
                                                        返却済
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className={log.isReturned ? "text-slate-400 line-through" : ""}>
                                                {log.vendor.name}
                                            </TableCell>
                                            <TableCell className={`font-mono text-sm ${log.isReturned ? "text-slate-400 line-through" : ""}`}>
                                                {log.modelNumber}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                }
                            </TableBody>
                        </Table>
                    )}
                    <Link href="/admin/aircon-logs" className="text-sm text-blue-600 hover:underline block mt-3">
                        すべて表示 →
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
