import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { AlertTriangle, TrendingDown, CheckCircle2, ClipboardList, Package, Fan, Calendar, MapPin } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

// 材料の発注アラート情報を取得
async function getLowStockMaterials() {
    const candidates = await prisma.product.findMany({
        where: { minStock: { gt: 0 } },
        include: {
            orderItems: {
                where: { order: { status: { in: ["ORDERED", "PARTIAL"] } } },
                select: { id: true },
            },
        },
        orderBy: [{ stock: "asc" }, { name: "asc" }],
    });

    return candidates
        .filter((p) => p.stock < p.minStock && p.orderItems.length === 0)
        .slice(0, 20);
}

// エアコン在庫を容量別に取得（AirconProductから直接）
async function getAirconInventory() {
    return prisma.airconProduct.findMany({
        orderBy: { capacity: "asc" },
        select: {
            id: true,
            code: true,
            name: true,
            capacity: true,
            stock: true,
            minStock: true,
        },
    });
}

// 持出し中エアコンのセット/内機/外機内訳
async function getAirconCheckoutBreakdown() {
    const logs = await prisma.airConditionerLog.findMany({
        where: { isReturned: false },
        select: { type: true },
    });
    const breakdown = { set: 0, indoor: 0, outdoor: 0, total: 0 };
    for (const log of logs) {
        const type = (log.type || 'SET') as 'SET' | 'INDOOR' | 'OUTDOOR';
        if (type === 'SET') breakdown.set++;
        else if (type === 'INDOOR') breakdown.indoor++;
        else if (type === 'OUTDOOR') breakdown.outdoor++;
        breakdown.total++;
    }
    return breakdown;
}

// 発注状況を取得（材料 + エアコン）
async function getPendingOrders() {
    const [materialOrders, airconOrders] = await Promise.all([
        prisma.order.findMany({
            where: { status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } },
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: "desc" },
        }),
        prisma.airconOrder.findMany({
            where: { status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } },
            include: { items: { include: { product: true } }, deliveryLocation: true },
            orderBy: { createdAt: "desc" },
        }),
    ]);
    return { materialOrders, airconOrders };
}

// 納期アラート取得
async function getDeliveryAlerts() {
    const now = new Date();
    const overdueOrders = await prisma.airconOrder.findMany({
        where: {
            status: { in: ["ORDERED", "PARTIAL"] },
            expectedDeliveryDate: { lt: now },
        },
        include: { items: { include: { product: true } } },
        orderBy: { expectedDeliveryDate: "asc" },
    });
    const noResponseOrders = await prisma.airconOrder.findMany({
        where: {
            status: { in: ["ORDERED", "PARTIAL"] },
            expectedDeliveryDate: null,
        },
        orderBy: { orderedAt: "asc" },
    });
    return { overdueOrders, noResponseOrders };
}

// 最近のエアコン持出し（3件、グループ化）
async function getRecentAirconLogs() {
    return prisma.airConditionerLog.findMany({
        take: 20, // グループ化の元データとして多めに取得
        orderBy: { createdAt: "desc" },
        include: {
            vendor: true,
            vendorUser: true,
        },
    });
}

const orderStatusLabel: Record<string, string> = {
    DRAFT: "下書き",
    ORDERED: "発注済",
    PARTIAL: "一部入荷",
    RECEIVED: "完了",
    CANCELLED: "キャンセル",
};

const orderStatusColor: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    ORDERED: "bg-blue-100 text-blue-700",
    PARTIAL: "bg-amber-100 text-amber-700",
};

const modelToLabel: Record<string, string> = {
    "RAS-AJ2225S": "2.2kw",
    "RAS-AJ2525S": "2.5kw",
    "RAS-AJ2825S": "2.8kw",
    "RAS-AJ3625S": "3.6kw",
};

// ログをグループ化（管理No + 日付 + 業者でグループ、3グループまで）
function groupLogs(logs: any[]) {
    const groups = new Map<string, any>();
    logs.forEach((log) => {
        const dateKey = new Date(log.createdAt).toISOString().split("T")[0];
        const key = `${log.managementNo || "NONE"}-${dateKey}-${log.vendor?.name || ""}`;
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                managementNo: log.managementNo,
                customerName: log.customerName,
                vendorName: log.vendor?.name || "",
                vendorUserName: log.vendorUser?.name,
                isProxyInput: log.isProxyInput,
                createdAt: log.createdAt,
                items: [],
                allReturned: true,
                someReturned: false,
                isTemporaryLoan: log.isTemporaryLoan,
            });
        }
        const group = groups.get(key)!;
        const itemKey = `${log.modelNumber}-${log.type || "SET"}`;
        let item = group.items.find(
            (i: any) => `${i.model}-${i.type}` === itemKey
        );
        if (!item) {
            item = {
                model: log.modelNumber,
                type: log.type || "SET",
                total: 0,
                returned: 0,
            };
            group.items.push(item);
        }
        item.total++;
        if (log.isReturned) {
            item.returned++;
            group.someReturned = true;
        } else {
            group.allReturned = false;
        }
    });
    return Array.from(groups.values())
        .sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
        )
        .slice(0, 3);
}

export default async function AdminDashboardPage() {
    const [lowStockMaterials, airconInventory, pendingOrders, recentAirconLogs, deliveryAlerts, airconBreakdown] =
        await Promise.all([
            getLowStockMaterials(),
            getAirconInventory(),
            getPendingOrders(),
            getRecentAirconLogs(),
            getDeliveryAlerts(),
            getAirconCheckoutBreakdown(),
        ]);

    const criticalMaterials = lowStockMaterials.filter((p) => p.stock === 0);
    const warningMaterials = lowStockMaterials.filter((p) => p.stock > 0);
    const hasPendingOrders =
        pendingOrders.materialOrders.length > 0 ||
        pendingOrders.airconOrders.length > 0;

    // エアコン在庫アラート
    const criticalAircon = airconInventory.filter(
        (ac) => ac.minStock > 0 && ac.stock === 0
    );
    const warningAircon = airconInventory.filter(
        (ac) => ac.minStock > 0 && ac.stock > 0 && ac.stock <= ac.minStock
    );

    const groupedLogs = groupLogs(recentAirconLogs);

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">
                    ダッシュボード
                </h2>
                <p className="text-muted-foreground">
                    在庫状況・発注アラート
                </p>
            </div>

            {/* ━━━ アラートバナー（コンパクト） ━━━ */}
            <div className="space-y-2">
                {/* 材料: 在庫切れ */}
                {criticalMaterials.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span className="text-sm text-red-800 font-medium">
                            材料 在庫切れ {criticalMaterials.length}件
                        </span>
                        <span className="text-xs text-red-600 truncate">
                            （
                            {criticalMaterials
                                .slice(0, 3)
                                .map((p) => p.name)
                                .join("、")}
                            {criticalMaterials.length > 3 &&
                                ` 他${criticalMaterials.length - 3}件`}
                            ）
                        </span>
                        <Link
                            href="/admin/orders"
                            className="ml-auto text-xs text-red-700 hover:underline whitespace-nowrap font-medium"
                        >
                            発注管理へ →
                        </Link>
                    </div>
                )}

                {/* 材料: 在庫注意 */}
                {warningMaterials.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <TrendingDown className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-sm text-amber-800 font-medium">
                            材料 在庫注意 {warningMaterials.length}件
                        </span>
                        <span className="text-xs text-amber-600 truncate">
                            （
                            {warningMaterials
                                .slice(0, 3)
                                .map((p) => `${p.name}:残${p.stock}`)
                                .join("、")}
                            {warningMaterials.length > 3 &&
                                ` 他${warningMaterials.length - 3}件`}
                            ）
                        </span>
                        <Link
                            href="/admin/products"
                            className="ml-auto text-xs text-amber-700 hover:underline whitespace-nowrap font-medium"
                        >
                            商品管理へ →
                        </Link>
                    </div>
                )}

                {/* エアコン: 在庫切れ */}
                {criticalAircon.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200">
                        <Fan className="w-4 h-4 text-red-600 shrink-0" />
                        <span className="text-sm text-red-800 font-medium">
                            エアコン 在庫切れ {criticalAircon.length}件
                        </span>
                        <span className="text-xs text-red-600 truncate">
                            （
                            {criticalAircon
                                .map((ac) => ac.capacity)
                                .join("、")}
                            ）
                        </span>
                        <Link
                            href="/admin/aircon-orders"
                            className="ml-auto text-xs text-red-700 hover:underline whitespace-nowrap font-medium"
                        >
                            エアコン発注へ →
                        </Link>
                    </div>
                )}

                {/* エアコン: 在庫注意 */}
                {warningAircon.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <Fan className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-sm text-amber-800 font-medium">
                            エアコン 在庫注意 {warningAircon.length}件
                        </span>
                        <span className="text-xs text-amber-600 truncate">
                            （
                            {warningAircon
                                .map(
                                    (ac) => `${ac.capacity}:残${ac.stock}`
                                )
                                .join("、")}
                            ）
                        </span>
                        <Link
                            href="/admin/aircon-orders"
                            className="ml-auto text-xs text-amber-700 hover:underline whitespace-nowrap font-medium"
                        >
                            エアコン発注へ →
                        </Link>
                    </div>
                )}

                {/* 納期超過アラート */}
                {deliveryAlerts.overdueOrders.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200">
                        <Calendar className="w-4 h-4 text-red-600 shrink-0" />
                        <span className="text-sm text-red-800 font-medium">
                            納期超過 {deliveryAlerts.overdueOrders.length}件
                        </span>
                        <span className="text-xs text-red-600 truncate">
                            （
                            {deliveryAlerts.overdueOrders
                                .slice(0, 3)
                                .map((o: any) => `${o.orderNumber || '#' + o.id}`)
                                .join('、')}
                            {deliveryAlerts.overdueOrders.length > 3 &&
                                ` 他${deliveryAlerts.overdueOrders.length - 3}件`}
                            ）
                        </span>
                        <Link
                            href="/admin/aircon-orders"
                            className="ml-auto text-xs text-red-700 hover:underline whitespace-nowrap font-medium"
                        >
                            発注管理へ →
                        </Link>
                    </div>
                )}

                {/* 納期未回答アラート */}
                {deliveryAlerts.noResponseOrders.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-sm text-amber-800 font-medium">
                            納期未回答 {deliveryAlerts.noResponseOrders.length}件
                        </span>
                        <Link
                            href="/admin/aircon-orders"
                            className="ml-auto text-xs text-amber-700 hover:underline whitespace-nowrap font-medium"
                        >
                            発注管理へ →
                        </Link>
                    </div>
                )}

                {/* すべて正常 */}
                {criticalMaterials.length === 0 &&
                    warningMaterials.length === 0 &&
                    criticalAircon.length === 0 &&
                    warningAircon.length === 0 &&
                    deliveryAlerts.overdueOrders.length === 0 &&
                    deliveryAlerts.noResponseOrders.length === 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 border border-green-200">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            <span className="text-sm text-green-700">
                                すべての在庫が十分です
                            </span>
                        </div>
                    )}
            </div>

            {/* ━━━ エアコン在庫テーブル（容量別） ━━━ */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Fan className="w-5 h-5" />
                        エアコン在庫（容量別）
                    </CardTitle>
                    {airconBreakdown.total > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge variant="secondary" className="text-xs bg-slate-100">
                                持出中: {airconBreakdown.total}台
                            </Badge>
                            {airconBreakdown.set > 0 && (
                                <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                                    セット:{airconBreakdown.set}
                                </Badge>
                            )}
                            {airconBreakdown.indoor > 0 && (
                                <Badge variant="secondary" className="text-xs bg-orange-50 text-orange-700">
                                    +内機のみ{airconBreakdown.indoor}台
                                </Badge>
                            )}
                            {airconBreakdown.outdoor > 0 && (
                                <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                                    +外機のみ{airconBreakdown.outdoor}台
                                </Badge>
                            )}
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {airconInventory.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            エアコン商品が登録されていません
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>品番</TableHead>
                                    <TableHead>容量</TableHead>
                                    <TableHead className="text-right">
                                        在庫
                                    </TableHead>
                                    <TableHead className="text-right">
                                        最低在庫
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {airconInventory.map((ac) => {
                                    const isLow =
                                        ac.minStock > 0 &&
                                        ac.stock <= ac.minStock;
                                    const isZero = ac.stock === 0;
                                    return (
                                        <TableRow
                                            key={ac.id}
                                            className={
                                                isZero
                                                    ? "bg-red-50"
                                                    : isLow
                                                        ? "bg-amber-50"
                                                        : ""
                                            }
                                        >
                                            <TableCell className="font-mono text-sm">
                                                {ac.code}
                                            </TableCell>
                                            <TableCell>
                                                {ac.capacity}
                                            </TableCell>
                                            <TableCell
                                                className={`text-right font-bold ${isZero ? "text-red-600" : isLow ? "text-amber-600" : ""}`}
                                            >
                                                {ac.stock}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {ac.minStock}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                    <div className="flex gap-4 mt-3">
                        <Link
                            href="/admin/aircon-inventory"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            エアコン棚卸管理へ →
                        </Link>
                        <Link
                            href="/admin/aircon-orders/settings"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            最低在庫設定 →
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* ━━━ 発注状況（材料・エアコン分離） ━━━ */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <ClipboardList className="w-5 h-5" />
                        発注状況
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!hasPendingOrders ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            処理待ちの発注はありません
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {/* 材料発注 */}
                            {pendingOrders.materialOrders.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                        <Package className="w-3.5 h-3.5" />{" "}
                                        材料発注
                                    </h4>
                                    <div className="space-y-1.5">
                                        {pendingOrders.materialOrders
                                            .slice(0, 3)
                                            .map((order: any) => (
                                                <div
                                                    key={order.id}
                                                    className="px-3 py-2 bg-slate-50 rounded-lg text-sm"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span>
                                                            発注 #
                                                            {order.orderNumber ||
                                                                order.id}
                                                            <Badge
                                                                className={`ml-2 ${orderStatusColor[order.status] || ""}`}
                                                                variant="outline"
                                                            >
                                                                {
                                                                    orderStatusLabel[
                                                                    order.status
                                                                    ]
                                                                }
                                                            </Badge>
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {order.items.length}品目
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1 truncate">
                                                        {order.items
                                                            .slice(0, 3)
                                                            .map((i: any) => i.product.name)
                                                            .join("、")}
                                                        {order.items.length > 3 && ` 他${order.items.length - 3}件`}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                    <Link
                                        href="/admin/orders"
                                        className="text-xs text-blue-600 hover:underline block mt-2"
                                    >
                                        材料発注管理へ →
                                    </Link>
                                </div>
                            )}

                            {/* エアコン発注 */}
                            {pendingOrders.airconOrders.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                        <Fan className="w-3.5 h-3.5" />{" "}
                                        エアコン発注
                                    </h4>
                                    <div className="space-y-1.5">
                                        {pendingOrders.airconOrders
                                            .slice(0, 3)
                                            .map((order: any) => {
                                                const locationName = order.deliveryLocation?.name || order.customDeliveryName || "未設定";
                                                const deliveryDate = order.expectedDeliveryDate
                                                    ? formatDate(new Date(order.expectedDeliveryDate))
                                                    : null;
                                                return (
                                                    <div
                                                        key={order.id}
                                                        className="px-3 py-2 bg-blue-50 rounded-lg text-sm"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span>
                                                                {order.orderNumber ||
                                                                    `発注 #${order.id}`}
                                                                <Badge
                                                                    className={`ml-2 ${orderStatusColor[order.status] || ""}`}
                                                                    variant="outline"
                                                                >
                                                                    {
                                                                        orderStatusLabel[
                                                                        order.status
                                                                        ]
                                                                    }
                                                                </Badge>
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {order.items
                                                                    .map(
                                                                        (i: any) =>
                                                                            `${i.product.capacity || i.product.code} ×${i.quantity}`
                                                                    )
                                                                    .join(", ")}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs mt-1">
                                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                                <MapPin className="w-3 h-3" />
                                                                {locationName}
                                                            </span>
                                                            <span className={`flex items-center gap-1 ${deliveryDate ? "text-muted-foreground" : "text-amber-600 font-medium"}`}>
                                                                <Calendar className="w-3 h-3" />
                                                                {deliveryDate || "納期未定"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                    <Link
                                        href="/admin/aircon-orders"
                                        className="text-xs text-blue-600 hover:underline block mt-2"
                                    >
                                        エアコン発注管理へ →
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ━━━ 最近のエアコン持出し（3グループ、履歴ページと同形式） ━━━ */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                        最近のエアコン持出し
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {groupedLogs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            データがありません
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[130px]">日時</TableHead>
                                    <TableHead className="w-[120px]">業者名</TableHead>
                                    <TableHead>管理No</TableHead>
                                    <TableHead>顧客名</TableHead>
                                    <TableHead>機種・台数</TableHead>
                                    <TableHead className="w-[80px] text-center">状態</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupedLogs.map((group: any) => (
                                    <TableRow
                                        key={group.key}
                                        className={
                                            group.allReturned
                                                ? "bg-green-50"
                                                : ""
                                        }
                                    >
                                        <TableCell className="text-sm">
                                            {formatDate(
                                                new Date(group.createdAt)
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">
                                                {group.isProxyInput && (
                                                    <span className="text-xs bg-purple-100 text-purple-700 px-1 rounded mr-1">
                                                        代
                                                    </span>
                                                )}
                                                {group.vendorName}
                                            </div>
                                            {group.vendorUserName && (
                                                <div className="text-xs text-slate-500">
                                                    (担) {group.vendorUserName}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {group.managementNo ===
                                                "INTERNAL" ? (
                                                <Badge
                                                    variant="secondary"
                                                    className="bg-slate-200 text-slate-700"
                                                >
                                                    自社在庫
                                                </Badge>
                                            ) : (
                                                group.managementNo || "-"
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {group.customerName || "-"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-0.5">
                                                {group.items.map(
                                                    (item: any) => (
                                                        <div
                                                            key={`${item.model}-${item.type}`}
                                                            className="flex items-center gap-1.5 text-sm"
                                                        >
                                                            <span
                                                                className={`text-[10px] px-1 rounded border ${item.type ===
                                                                    "SET"
                                                                    ? "bg-slate-100 text-slate-600 border-slate-300"
                                                                    : item.type ===
                                                                        "INDOOR"
                                                                        ? "bg-blue-100 text-blue-600 border-blue-300"
                                                                        : item.type ===
                                                                            "PURCHASE"
                                                                            ? "bg-red-100 text-red-600 border-red-300"
                                                                            : "bg-orange-100 text-orange-600 border-orange-300"
                                                                    }`}
                                                            >
                                                                {item.type ===
                                                                    "SET"
                                                                    ? "セット"
                                                                    : item.type ===
                                                                        "INDOOR"
                                                                        ? "内機"
                                                                        : item.type ===
                                                                            "PURCHASE"
                                                                            ? "買取"
                                                                            : "外機"}
                                                            </span>
                                                            <span className="font-bold">
                                                                {modelToLabel[
                                                                    item.model
                                                                ] ||
                                                                    item.model}
                                                            </span>
                                                            <span className="text-blue-700 font-bold">
                                                                ×{item.total}
                                                            </span>
                                                            {item.returned >
                                                                0 && (
                                                                    <span className="text-green-600 text-xs">
                                                                        (戻
                                                                        {
                                                                            item.returned
                                                                        }
                                                                        )
                                                                    </span>
                                                                )}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {group.allReturned ? (
                                                <Badge className="bg-green-100 text-green-700">
                                                    戻し済
                                                </Badge>
                                            ) : group.someReturned ? (
                                                <Badge className="bg-amber-100 text-amber-700">
                                                    一部戻し
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">
                                                    引当済
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    <Link
                        href="/admin/aircon-logs"
                        className="text-sm text-blue-600 hover:underline block mt-2"
                    >
                        すべて表示 →
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
