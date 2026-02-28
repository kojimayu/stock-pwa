"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isToday, isYesterday, isThisWeek, isThisMonth, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import {
    Search, Package, LogIn, ShoppingCart, ClipboardCheck, Settings,
    Truck, MapPin, User, FileText, AlertTriangle, RotateCcw, Activity
} from "lucide-react";

// ===============================
// カテゴリ定義
// ===============================
const LOG_CATEGORIES: Record<string, { label: string; actions: string[] }> = {
    all: { label: "すべてのカテゴリ", actions: [] },
    aircon_order: {
        label: "エアコン発注",
        actions: ["AIRCON_ORDER_CREATE", "AIRCON_ORDER_DELETE", "AIRCON_ORDER_STATUS",
            "AIRCON_ORDER_DELIVERY_DATE", "AIRCON_ORDER_RECEIVE", "AIRCON_ORDER_EMAIL_SENT"],
    },
    aircon_stock: {
        label: "エアコン在庫",
        actions: ["AIRCON_STOCK_ADJUST", "AIRCON_STOCK_DECREMENT", "AIRCON_RETURN",
            "AIRCON_PRICE_UPDATE", "AIRCON_MIN_STOCK_UPDATE", "AIRCON_SUFFIX_UPDATE",
            "AIRCON_YEAR_SUFFIX_UPDATE"],
    },
    aircon_inventory: {
        label: "エアコン棚卸",
        actions: ["AIRCON_INVENTORY_START", "AIRCON_INVENTORY_COMPLETE", "AIRCON_INVENTORY_CANCEL"],
    },
    aircon_log: {
        label: "エアコン持出し",
        actions: ["AIRCON_LOG_UPDATE", "AIRCON_LOG_ASSIGNMENT"],
    },
    material_order: {
        label: "材料発注",
        actions: ["ORDER_DRAFT_GENERATE", "ORDER_CONFIRM", "ORDER_ITEM_RECEIVE",
            "ORDER_RECEIVE_CANCEL", "ORDER_CANCEL", "ORDER_DELETE",
            "ORDER_CREATE", "ORDER_ITEM_DELETE"],
    },
    material_stock: {
        label: "材料在庫・棚卸",
        actions: ["PRODUCT_UPDATE", "PRODUCT_CREATE", "PRODUCT_DELETE",
            "IMPORT", "TRANSACTION_UPDATE",
            "INVENTORY_START", "INVENTORY_FINALIZE", "INVENTORY_CANCEL"],
    },
    transaction: {
        label: "材料取引（代理入力・返品）",
        actions: ["PROXY_INPUT", "RETURN_TRANSACTION", "RETURN_PARTIAL_TRANSACTION"],
    },
    login: {
        label: "ログイン・認証",
        actions: ["LOGIN", "KIOSK_LOGIN_FAILED", "KIOSK_LOGIN_SUCCESS",
            "LOGOUT", "AUTO_LOGOUT", "ADMIN_LOGIN"],
    },
    vendor: {
        label: "業者・担当者管理",
        actions: ["VENDOR_CREATE", "VENDOR_UPDATE", "VENDOR_DELETE",
            "VENDOR_USER_CREATE", "VENDOR_USER_DELETE",
            "VENDOR_USER_PIN_CHANGE", "VENDOR_USER_PIN_RESET", "VENDOR_QR_GENERATE"],
    },
    settings: {
        label: "設定・拠点",
        actions: ["EMAIL_SETTING_UPDATE", "DELIVERY_LOCATION_CREATE",
            "DELIVERY_LOCATION_UPDATE", "DELIVERY_LOCATION_DELETE"],
    },
};

// 日付フィルタ
const DATE_FILTERS: Record<string, { label: string; filter: (d: Date) => boolean }> = {
    all: { label: "全期間", filter: () => true },
    today: { label: "今日", filter: (d) => isToday(d) },
    yesterday: { label: "昨日", filter: (d) => isYesterday(d) },
    week: { label: "今週", filter: (d) => isThisWeek(d, { locale: ja }) },
    month: { label: "今月", filter: (d) => isThisMonth(d) },
};

// action → 日本語ラベル
const ACTION_LABELS: Record<string, string> = {
    AIRCON_ORDER_CREATE: "発注作成", AIRCON_ORDER_DELETE: "発注削除",
    AIRCON_ORDER_STATUS: "ステータス変更", AIRCON_ORDER_DELIVERY_DATE: "納期回答",
    AIRCON_ORDER_RECEIVE: "入荷チェック", AIRCON_ORDER_EMAIL_SENT: "メール送信",
    AIRCON_STOCK_ADJUST: "在庫調整", AIRCON_STOCK_DECREMENT: "持出し減算",
    AIRCON_RETURN: "返却", AIRCON_PRICE_UPDATE: "単価更新",
    AIRCON_MIN_STOCK_UPDATE: "最低在庫更新", AIRCON_SUFFIX_UPDATE: "サフィックス更新",
    AIRCON_YEAR_SUFFIX_UPDATE: "年度サフィックス",
    AIRCON_INVENTORY_START: "棚卸開始", AIRCON_INVENTORY_COMPLETE: "棚卸確定",
    AIRCON_INVENTORY_CANCEL: "棚卸中止",
    AIRCON_LOG_UPDATE: "管理情報更新", AIRCON_LOG_ASSIGNMENT: "物件引き当て",
    ORDER_DRAFT_GENERATE: "下書き生成", ORDER_CONFIRM: "発注確定",
    ORDER_ITEM_RECEIVE: "入荷", ORDER_RECEIVE_CANCEL: "入荷取消",
    ORDER_CANCEL: "発注キャンセル", ORDER_DELETE: "発注削除",
    ORDER_CREATE: "手動発注", ORDER_ITEM_DELETE: "商品削除",
    PRODUCT_UPDATE: "商品更新", PRODUCT_CREATE: "商品作成",
    PRODUCT_DELETE: "商品削除", IMPORT: "一括インポート",
    TRANSACTION_UPDATE: "取引修正",
    INVENTORY_START: "棚卸開始", INVENTORY_FINALIZE: "棚卸確定",
    INVENTORY_CANCEL: "棚卸中止",
    PROXY_INPUT: "代理入力",
    RETURN_TRANSACTION: "全返品", RETURN_PARTIAL_TRANSACTION: "一部返品",
    LOGIN: "ログイン", KIOSK_LOGIN_FAILED: "ログイン失敗",
    KIOSK_LOGIN_SUCCESS: "ログイン成功", LOGOUT: "ログアウト",
    AUTO_LOGOUT: "自動ログアウト", ADMIN_LOGIN: "管理者ログイン",
    VENDOR_CREATE: "業者作成", VENDOR_UPDATE: "業者更新", VENDOR_DELETE: "業者削除",
    VENDOR_USER_CREATE: "担当者追加", VENDOR_USER_DELETE: "担当者削除",
    VENDOR_USER_PIN_CHANGE: "PIN変更", VENDOR_USER_PIN_RESET: "PINリセット",
    VENDOR_QR_GENERATE: "QR生成",
    EMAIL_SETTING_UPDATE: "メール設定",
    DELIVERY_LOCATION_CREATE: "拠点作成", DELIVERY_LOCATION_UPDATE: "拠点更新",
    DELIVERY_LOCATION_DELETE: "拠点削除",
    PERFORMANCE_WARNING: "パフォーマンス警告", STOCK_ADJUSTMENT: "在庫補正",
};

function getActionLabel(action: string) { return ACTION_LABELS[action] || action; }

function getCategoryKey(action: string): string {
    for (const [key, cat] of Object.entries(LOG_CATEGORIES)) {
        if (key === "all") continue;
        if (cat.actions.includes(action)) return key;
    }
    return "system";
}

function getCategoryLabel(action: string): string {
    const key = getCategoryKey(action);
    return LOG_CATEGORIES[key]?.label || "その他";
}

function extractExecutor(details: string | null): string | null {
    if (!details) return null;
    const m = details.match(/\[By: (.+?)\]/);
    return m ? m[1] : null;
}

function cleanDetails(details: string | null): string {
    return (details || "").replace(/\s*\[By:.*?\]/, "").trim();
}

// ===============================
// バッジカラー
// ===============================
function getActionColor(action: string): string {
    if (action.includes("CREATE") || action.includes("START")) return "bg-blue-50 text-blue-700 border-blue-200";
    if (action.includes("UPDATE") || action.includes("ADJUST")) return "bg-amber-50 text-amber-700 border-amber-200";
    if (action.includes("DELETE") || action.includes("CANCEL")) return "bg-red-50 text-red-700 border-red-200";
    if (action.includes("RECEIVE")) return "bg-green-50 text-green-700 border-green-200";
    if (action.includes("COMPLETE") || action.includes("FINALIZE")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (action.includes("LOGIN") || action.includes("LOGOUT")) return "bg-sky-50 text-sky-700 border-sky-200";
    if (action.includes("FAILED") || action.includes("WARNING")) return "bg-red-50 text-red-700 border-red-200";
    if (action.includes("RETURN")) return "bg-purple-50 text-purple-700 border-purple-200";
    if (action === "IMPORT") return "bg-violet-50 text-violet-700 border-violet-200";
    if (action.includes("EMAIL")) return "bg-cyan-50 text-cyan-700 border-cyan-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
}

function getCategoryColor(key: string): string {
    const m: Record<string, string> = {
        aircon_order: "text-blue-600", aircon_stock: "text-emerald-600",
        aircon_inventory: "text-amber-600", aircon_log: "text-orange-600",
        material_order: "text-violet-600", material_stock: "text-teal-600",
        transaction: "text-pink-600", login: "text-sky-600",
        vendor: "text-indigo-600", settings: "text-gray-600",
    };
    return m[key] || "text-slate-600";
}

// ===============================
// メインコンポーネント
// ===============================
type LogEntry = {
    id: number;
    action: string;
    target: string;
    details: string | null;
    performedAt: Date;
};

export default function OperationLogsClient({ logs }: { logs: LogEntry[] }) {
    const [category, setCategory] = useState("all");
    const [dateRange, setDateRange] = useState("all");
    const [executor, setExecutor] = useState("all");
    const [searchText, setSearchText] = useState("");

    // 操作者の一覧を抽出
    const executors = useMemo(() => {
        const set = new Set<string>();
        logs.forEach(log => {
            const ex = extractExecutor(log.details);
            if (ex && ex !== "System/Guest") set.add(ex);
        });
        return Array.from(set).sort();
    }, [logs]);

    // フィルタ適用
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // カテゴリ
            if (category !== "all") {
                const actions = LOG_CATEGORIES[category]?.actions || [];
                if (!actions.includes(log.action)) return false;
            }
            // 日付
            if (dateRange !== "all") {
                const df = DATE_FILTERS[dateRange];
                if (df && !df.filter(new Date(log.performedAt))) return false;
            }
            // 操作者
            if (executor !== "all") {
                const ex = extractExecutor(log.details);
                if (ex !== executor) return false;
            }
            // テキスト検索
            if (searchText.trim()) {
                const q = searchText.toLowerCase();
                const match =
                    log.target.toLowerCase().includes(q) ||
                    (log.details || "").toLowerCase().includes(q) ||
                    getActionLabel(log.action).includes(q);
                if (!match) return false;
            }
            return true;
        });
    }, [logs, category, dateRange, executor, searchText]);

    // サマリー
    const todayCount = useMemo(() =>
        logs.filter(l => isToday(new Date(l.performedAt))).length
        , [logs]);

    const topCategories = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredLogs.forEach(l => {
            const key = getCategoryKey(l.action);
            counts[key] = (counts[key] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);
    }, [filteredLogs]);

    const hasActiveFilter = category !== "all" || dateRange !== "all" || executor !== "all" || searchText.trim();

    return (
        <div className="space-y-5">
            {/* ヘッダー */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="h-6 w-6 text-slate-500" />
                        操作ログ
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">直近200件の操作履歴</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold">{todayCount}</div>
                    <div className="text-xs text-muted-foreground">今日の操作</div>
                </div>
            </div>

            {/* フィルタバー */}
            <div className="flex flex-wrap gap-2 items-center">
                {/* カテゴリ */}
                <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(LOG_CATEGORIES).map(([key, cat]) => (
                            <SelectItem key={key} value={key}>
                                {cat.label}
                                {key !== "all" && (() => {
                                    const c = logs.filter(l => cat.actions.includes(l.action)).length;
                                    return c > 0 ? ` (${c})` : "";
                                })()}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* 日付 */}
                <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(DATE_FILTERS).map(([key, df]) => (
                            <SelectItem key={key} value={key}>{df.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* 操作者 */}
                <Select value={executor} onValueChange={setExecutor}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">すべての操作者</SelectItem>
                        {executors.map(ex => (
                            <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* フィルタクリア（ドロップダウン直後に配置） */}
                {hasActiveFilter && (
                    <button
                        onClick={() => { setCategory("all"); setDateRange("all"); setExecutor("all"); setSearchText(""); }}
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap px-1"
                    >
                        ✕ クリア
                    </button>
                )}

                {/* 検索 */}
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="対象・詳細で検索..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="pl-8 h-9"
                    />
                </div>
            </div>

            {/* カテゴリ分布（フィルタなしの時のみ） */}
            {!hasActiveFilter && topCategories.length > 0 && (
                <div className="flex flex-wrap gap-3">
                    {topCategories.map(([key, count]) => (
                        <button
                            key={key}
                            onClick={() => setCategory(key)}
                            className={`text-xs px-2.5 py-1 rounded-full border hover:bg-slate-50 transition ${getCategoryColor(key)}`}
                        >
                            {LOG_CATEGORIES[key]?.label} <span className="font-bold ml-0.5">{count}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* 件数表示 */}
            <div className="text-xs text-muted-foreground">
                {filteredLogs.length} 件{hasActiveFilter ? `（全${logs.length}件中）` : ""}
            </div>

            {/* テーブル（PC） */}
            <Card className="hidden md:block">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead className="w-[130px] pl-4">日時</TableHead>
                                <TableHead className="w-[130px]">カテゴリ</TableHead>
                                <TableHead className="w-[110px]">操作</TableHead>
                                <TableHead className="w-[200px]">対象</TableHead>
                                <TableHead>詳細</TableHead>
                                <TableHead className="w-[130px] pr-4">操作者</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLogs.map((log) => {
                                const catKey = getCategoryKey(log.action);
                                const ex = extractExecutor(log.details);
                                const det = cleanDetails(log.details);
                                const d = new Date(log.performedAt);
                                const dateStr = isToday(d)
                                    ? format(d, "HH:mm:ss")
                                    : isYesterday(d)
                                        ? `昨日 ${format(d, "HH:mm")}`
                                        : format(d, "MM/dd HH:mm");
                                return (
                                    <TableRow key={log.id} className="group hover:bg-blue-50/30">
                                        <TableCell className="font-mono text-xs text-slate-500 pl-4">
                                            {dateStr}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`text-[11px] font-medium ${getCategoryColor(catKey)}`}>
                                                {LOG_CATEGORIES[catKey]?.label || "その他"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${getActionColor(log.action)}`}>
                                                {getActionLabel(log.action)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm font-medium truncate max-w-[200px]" title={log.target}>
                                            {log.target}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]" title={det}>
                                            {det || "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500 pr-4">
                                            {ex && ex !== "System/Guest" ? ex : <span className="text-slate-300">—</span>}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {filteredLogs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        該当するログがありません
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* カード型（スマホ） */}
            <div className="md:hidden space-y-1.5">
                {filteredLogs.map((log) => {
                    const catKey = getCategoryKey(log.action);
                    const ex = extractExecutor(log.details);
                    const det = cleanDetails(log.details);
                    const d = new Date(log.performedAt);
                    const dateStr = isToday(d)
                        ? format(d, "HH:mm")
                        : isYesterday(d)
                            ? `昨日 ${format(d, "HH:mm")}`
                            : format(d, "MM/dd HH:mm");

                    return (
                        <div key={log.id} className="border rounded-lg px-3 py-2.5 space-y-1 bg-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[11px] font-medium ${getCategoryColor(catKey)}`}>
                                        {LOG_CATEGORIES[catKey]?.label}
                                    </span>
                                    <span className="text-slate-300">·</span>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${getActionColor(log.action)}`}>
                                        {getActionLabel(log.action)}
                                    </span>
                                </div>
                                <span className="font-mono text-[11px] text-slate-400">{dateStr}</span>
                            </div>
                            <div className="text-sm font-medium">{log.target}</div>
                            {det && <p className="text-xs text-muted-foreground line-clamp-2">{det}</p>}
                            {ex && ex !== "System/Guest" && (
                                <p className="text-[11px] text-slate-400">👤 {ex}</p>
                            )}
                        </div>
                    );
                })}
                {filteredLogs.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">該当するログがありません</div>
                )}
            </div>
        </div>
    );
}
