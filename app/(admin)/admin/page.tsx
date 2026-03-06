import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { AlertTriangle, TrendingDown, CheckCircle2, ClipboardList, Package, Fan, Calendar, MapPin, Calculator, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getAirconStockWithVendorBreakdown } from "@/lib/aircon-actions";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

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

// エアコン在庫はaircon-actionsのgetAirconStockWithVendorBreakdownを使用

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
    // 本日の範囲（今日の0:00〜23:59）
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // 本日納品予定
    const todayOrders = await prisma.airconOrder.findMany({
        where: {
            status: { in: ["ORDERED", "PARTIAL"] },
            expectedDeliveryDate: { gte: todayStart, lt: todayEnd },
        },
        include: { items: { include: { product: true } } },
        orderBy: { expectedDeliveryDate: "asc" },
    });
    // 納期超過（本日より前 = 昨日以前）
    const overdueOrders = await prisma.airconOrder.findMany({
        where: {
            status: { in: ["ORDERED", "PARTIAL"] },
            expectedDeliveryDate: { lt: todayStart },
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
    return { todayOrders, overdueOrders, noResponseOrders };
}

// 価格アラート取得
async function getPriceAlerts() {
    const products = await prisma.product.findMany({
        select: {
            id: true, code: true, name: true, category: true,
            priceA: true, priceB: true, cost: true, priceMode: true,
        },
    });
    const rules = await prisma.categoryPricingRule.findMany();
    const ruleMap = new Map(rules.map((r: any) => [r.category, r]));

    const violations: typeof products = [];
    const markupDiffs: Array<typeof products[0] & { expectedA: number; diff: number }> = [];
    const noCost = products.filter(p => p.cost === 0 && p.priceA > 0);

    products.forEach(p => {
        // セーフガード違反
        if (p.cost > 0 && p.priceA > 0 && p.priceA <= p.cost) violations.push(p);
        else if (p.cost > 0 && p.priceB > 0 && p.priceB <= p.cost) violations.push(p);
        else if (p.priceA > 0 && p.priceB > 0) {
            // MANUAL: 同額もNG、AUTO: 同額OK
            if (p.priceMode === 'MANUAL' ? p.priceA <= p.priceB : p.priceA < p.priceB) violations.push(p);
        }

        // 掛率ズレ（AUTOのみ）
        if (p.priceMode === 'AUTO' && p.cost > 0) {
            const rule = ruleMap.get(p.category);
            if (rule) {
                const expectedA = Math.ceil(p.cost * (rule as any).markupRateA);
                const diff = p.priceA - expectedA;
                if (diff !== 0) markupDiffs.push({ ...p, expectedA, diff });
            }
        }
    });

    return { violations, markupDiffs, noCost };
}

// 最近の在庫調整から取り違えペア数を取得（ダッシュボード用）
async function getSwapPairCount() {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const adjustments = await prisma.inventoryLog.findMany({
        where: {
            createdAt: { gte: since },
            type: { in: ['CORRECTION', 'DISPOSAL', 'INVENTORY_ADJUSTMENT'] },
            quantity: { not: 0 },
        },
        select: { quantity: true },
    });

    const shortage = adjustments.filter(a => a.quantity < 0);
    const excess = adjustments.filter(a => a.quantity > 0);

    // ペアになりうる組み合わせ数（min）
    return Math.min(shortage.length, excess.length);
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
    const [lowStockMaterials, airconInventory, pendingOrders, recentAirconLogs, deliveryAlerts, priceAlerts, swapPairCount] =
        await Promise.all([
            getLowStockMaterials(),
            getAirconStockWithVendorBreakdown(),
            getPendingOrders(),
            getRecentAirconLogs(),
            getDeliveryAlerts(),
            getPriceAlerts(),
            getSwapPairCount(),
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
                            材料 発注管理へ →
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
                            href="/admin/orders"
                            className="ml-auto text-xs text-amber-700 hover:underline whitespace-nowrap font-medium"
                        >
                            材料 発注管理へ →
                        </Link>
                    </div>
                )}

                {/* 本日納品予定のお知らせ */}
                {deliveryAlerts.todayOrders.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200">
                        <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-sm text-blue-800 font-medium">
                            本日納品予定 {deliveryAlerts.todayOrders.length}件
                        </span>
                        <span className="text-xs text-blue-600 truncate">
                            （
                            {deliveryAlerts.todayOrders
                                .slice(0, 3)
                                .map((o: any) => `${o.orderNumber || '#' + o.id}`)
                                .join('、')}
                            {deliveryAlerts.todayOrders.length > 3 &&
                                ` 他${deliveryAlerts.todayOrders.length - 3}件`}
                            ）
                        </span>
                        <Link
                            href="/admin/aircon-orders"
                            className="ml-auto text-xs text-blue-700 hover:underline whitespace-nowrap font-medium"
                        >
                            エアコン 発注管理へ →
                        </Link>
                    </div>
                )}

                {/* 納期超過アラート（入荷日を過ぎたもののみ） */}
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
                            エアコン 発注管理へ →
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
                            エアコン 発注管理へ →
                        </Link>
                    </div>
                )}

                {/* 価格: セーフガード違反 */}
                {priceAlerts.violations.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200">
                        <Calculator className="w-4 h-4 text-red-600 shrink-0" />
                        <span className="text-sm text-red-800 font-medium">
                            価格セーフガード違反 {priceAlerts.violations.length}件
                        </span>
                        <span className="text-xs text-red-600 truncate">
                            （{priceAlerts.violations.slice(0, 3).map((p: any) => p.code).join('、')}
                            {priceAlerts.violations.length > 3 && ` 他${priceAlerts.violations.length - 3}件`}）
                        </span>
                        <Link href="/admin/pricing" className="ml-auto text-xs text-red-700 hover:underline whitespace-nowrap font-medium">
                            価格設定へ →
                        </Link>
                    </div>
                )}

                {/* 価格: 掛率ズレ */}
                {priceAlerts.markupDiffs.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <Calculator className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-sm text-amber-800 font-medium">
                            掛率ズレ {priceAlerts.markupDiffs.length}件
                        </span>
                        <span className="text-xs text-amber-600 truncate">
                            （AUTO商品で実価格と掛率計算値が不一致）
                        </span>
                        <Link href="/admin/pricing" className="ml-auto text-xs text-amber-700 hover:underline whitespace-nowrap font-medium">
                            価格設定へ →
                        </Link>
                    </div>
                )}

                {/* 価格: 仕入値未設定 */}
                {priceAlerts.noCost.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <Calculator className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-sm text-slate-700 font-medium">
                            仕入値未設定 {priceAlerts.noCost.length}件
                        </span>
                        <Link href="/admin/pricing" className="ml-auto text-xs text-slate-600 hover:underline whitespace-nowrap font-medium">
                            価格設定へ →
                        </Link>
                    </div>
                )}

                {/* すべて正常 */}
                {criticalMaterials.length === 0 &&
                    warningMaterials.length === 0 &&
                    deliveryAlerts.overdueOrders.length === 0 &&
                    deliveryAlerts.noResponseOrders.length === 0 &&
                    deliveryAlerts.todayOrders.length === 0 &&
                    priceAlerts.violations.length === 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 border border-green-200">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            <span className="text-sm text-green-700">
                                すべて正常です
                            </span>
                        </div>
                    )}
            </div>

            {/* 商品取り違えアラート（件数+リンクのみ） */}
            {swapPairCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-50 border border-purple-200">
                    <Search className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="text-sm text-purple-800 font-medium">
                        商品取り違えの可能性 {swapPairCount}件
                    </span>
                    <span className="text-xs text-purple-600">
                        （過去7日の在庫調整）
                    </span>
                    <Link
                        href="/admin/products"
                        className="ml-auto text-xs text-purple-700 hover:underline whitespace-nowrap font-medium"
                    >
                        在庫管理へ →
                    </Link>
                </div>
            )}

            {/* ━━━ エアコン在庫テーブル（容量別） ━━━ */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Fan className="w-5 h-5" />
                        エアコン在庫（容量別）
                    </CardTitle>
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
                                    <TableHead className="text-center bg-blue-50/50">倉庫在庫</TableHead>
                                    <TableHead className="text-center bg-orange-50/50">業者持出</TableHead>
                                    <TableHead className="text-center bg-purple-50/50">持出し内訳</TableHead>
                                    <TableHead className="text-center bg-slate-50/50">総在庫</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {airconInventory.map((ac) => {
                                    const isLow =
                                        ac.minStock > 0 &&
                                        ac.totalStock <= ac.minStock;
                                    const isZero = ac.stock === 0;
                                    const { indoor, outdoor } = ac.typeBreakdown;
                                    const extraOutdoor = indoor > outdoor ? indoor - outdoor : 0;
                                    const extraIndoor = outdoor > indoor ? outdoor - indoor : 0;
                                    const setCount = ac.totalStock - extraOutdoor - extraIndoor;
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
                                                {isLow && (
                                                    <AlertTriangle className="inline w-3.5 h-3.5 ml-1 text-amber-500" />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {ac.capacity}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`font-bold text-lg ${isZero ? "text-red-600" : "text-blue-700"}`}>
                                                    {ac.stock}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {ac.vendorStock > 0 ? (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" className="h-8 hover:bg-orange-100 text-orange-700 font-bold text-lg underline decoration-dashed underline-offset-4">
                                                                {ac.vendorStock}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-72 p-3">
                                                            <div className="space-y-2">
                                                                <h4 className="font-medium text-sm border-b pb-1 mb-2">保有業者内訳</h4>
                                                                {ac.vendorBreakdown.map((v: any) => (
                                                                    <div key={v.id} className="flex justify-between items-center text-sm gap-2">
                                                                        <span className="truncate max-w-[120px]">{v.name}</span>
                                                                        <div className="flex gap-1">
                                                                            {v.set > 0 && <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">S{v.set}</Badge>}
                                                                            {v.indoor > 0 && <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">内{v.indoor}</Badge>}
                                                                            {v.outdoor > 0 && <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">外{v.outdoor}</Badge>}
                                                                            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                                                                計{v.count}
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="bg-purple-50/30">
                                                {(() => {
                                                    const { set, indoor, outdoor } = ac.typeBreakdown;
                                                    const hasAny = set > 0 || indoor > 0 || outdoor > 0;
                                                    if (!hasAny) return <span className="text-slate-400 text-center block">-</span>;

                                                    const eIndoor = outdoor > indoor ? outdoor - indoor : 0;
                                                    const eOutdoor = indoor > outdoor ? indoor - outdoor : 0;

                                                    return (
                                                        <div className="text-xs space-y-0.5 whitespace-nowrap">
                                                            {set > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="inline-block w-8 text-blue-700 font-medium">SET</span>
                                                                    <span className="font-bold text-blue-800">{set}</span>
                                                                </div>
                                                            )}
                                                            {indoor > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="inline-block w-8 text-green-700 font-medium">内機</span>
                                                                    <span className="font-bold text-green-800">{indoor}</span>
                                                                </div>
                                                            )}
                                                            {outdoor > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="inline-block w-8 text-orange-700 font-medium">外機</span>
                                                                    <span className="font-bold text-orange-800">{outdoor}</span>
                                                                </div>
                                                            )}
                                                            {(eIndoor > 0 || eOutdoor > 0) && (
                                                                <div className="mt-1 pt-1 border-t border-purple-200">
                                                                    {eOutdoor > 0 && (
                                                                        <div className="text-amber-600 font-medium">
                                                                            → 外機 {eOutdoor}台 倉庫余り
                                                                        </div>
                                                                    )}
                                                                    {eIndoor > 0 && (
                                                                        <div className="text-amber-600 font-medium">
                                                                            → 内機 {eIndoor}台 倉庫余り
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div>
                                                    <span className="font-bold text-lg text-slate-900">
                                                        {setCount}
                                                    </span>
                                                    <span className="text-xs text-slate-500 ml-0.5">セット</span>
                                                    {extraOutdoor > 0 && (
                                                        <div className="text-xs text-amber-600">
                                                            + 外機のみ {extraOutdoor}台
                                                        </div>
                                                    )}
                                                    {extraIndoor > 0 && (
                                                        <div className="text-xs text-amber-600">
                                                            + 内機のみ {extraIndoor}台
                                                        </div>
                                                    )}
                                                </div>
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
