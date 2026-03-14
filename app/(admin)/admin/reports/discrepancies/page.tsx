"use client";

import { useState, useEffect, useTransition } from "react";
import { getStockDiscrepancies, resolveDiscrepancy } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertTriangle, CheckCircle, Package, Filter,
    ArrowLeft, MessageSquare, Loader2
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type StatusFilter = "PENDING" | "RESOLVED" | "ALL";

type Discrepancy = {
    id: number;
    productId: number;
    vendorId: number;
    reportedStock: number;
    systemStock: number;
    note: string | null;
    status: string;
    resolvedAt: string | null;
    createdAt: string;
    product: { id: number; code: string | null; name: string; stock: number; unit: string | null };
    vendor: { id: number; name: string };
};

export default function DiscrepancyTrackingPage() {
    const [filter, setFilter] = useState<StatusFilter>("PENDING");
    const [data, setData] = useState<Discrepancy[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState<number | null>(null);
    const [resolveNote, setResolveNote] = useState("");
    const [isPending, startTransition] = useTransition();

    const fetchData = async () => {
        setLoading(true);
        try {
            const status = filter === "ALL" ? undefined : filter;
            const result = await getStockDiscrepancies(status);
            setData(result as any);
        } catch {
            toast.error("データの取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filter]);

    const handleResolve = async (id: number) => {
        startTransition(async () => {
            try {
                await resolveDiscrepancy(id, resolveNote || undefined);
                toast.success("処理済みに変更しました");
                setResolvingId(null);
                setResolveNote("");
                fetchData();
            } catch (error: any) {
                toast.error(error?.message || "処理に失敗しました");
            }
        });
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("ja-JP", {
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
        });
    };

    const pendingCount = data.filter(d => d.status === "PENDING").length;

    return (
        <div className="space-y-6">
            {/* ヘッダー */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/admin" className="text-slate-400 hover:text-slate-600">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">在庫不一致申告</h1>
                        <p className="text-sm text-slate-500">
                            業者からの在庫不一致報告を管理します
                        </p>
                    </div>
                </div>
                {pendingCount > 0 && (
                    <div className="px-3 py-1.5 bg-orange-100 border border-orange-300 rounded-full text-sm font-bold text-orange-700">
                        未処理 {pendingCount}件
                    </div>
                )}
            </div>

            {/* フィルター */}
            <div className="flex gap-2">
                {([
                    { value: "PENDING" as StatusFilter, label: "未処理", icon: AlertTriangle, color: "orange" },
                    { value: "RESOLVED" as StatusFilter, label: "処理済み", icon: CheckCircle, color: "green" },
                    { value: "ALL" as StatusFilter, label: "すべて", icon: Filter, color: "slate" },
                ]).map(({ value, label, icon: Icon, color }) => (
                    <Button
                        key={value}
                        variant={filter === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(value)}
                        className={filter === value
                            ? `bg-${color}-600 hover:bg-${color}-700 text-white`
                            : ""
                        }
                    >
                        <Icon className="w-4 h-4 mr-1" />
                        {label}
                    </Button>
                ))}
            </div>

            {/* 一覧 */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
            ) : data.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                        <p className="text-slate-500">
                            {filter === "PENDING" ? "未処理の申告はありません" : "申告はありません"}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {data.map((d) => {
                        const diff = d.reportedStock - d.systemStock;
                        const isPending = d.status === "PENDING";
                        const isResolving = resolvingId === d.id;

                        return (
                            <Card
                                key={d.id}
                                className={`${isPending
                                    ? "border-orange-200 bg-orange-50/50"
                                    : "border-slate-200 bg-slate-50/50"
                                }`}
                            >
                                <CardContent className="p-4">
                                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                                        {/* 左: ステータスアイコン */}
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                            isPending ? "bg-orange-100" : "bg-green-100"
                                        }`}>
                                            {isPending ? (
                                                <AlertTriangle className="w-5 h-5 text-orange-600" />
                                            ) : (
                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                            )}
                                        </div>

                                        {/* 中央: 詳細 */}
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-900">
                                                    {d.product.name}
                                                </span>
                                                {d.product.code && (
                                                    <span className="text-xs text-slate-400">
                                                        {d.product.code}
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    isPending
                                                        ? "bg-orange-100 text-orange-700"
                                                        : "bg-green-100 text-green-700"
                                                }`}>
                                                    {isPending ? "未処理" : "処理済み"}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                                                <div>
                                                    <span className="text-slate-500">申告元</span>
                                                    <p className="font-medium text-slate-800">{d.vendor.name}</p>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">申告日時</span>
                                                    <p className="font-medium text-slate-800">
                                                        {formatDate(d.createdAt)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">システム在庫</span>
                                                    <p className="font-medium text-slate-800">
                                                        {d.systemStock}{d.product.unit || "個"}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">報告在庫</span>
                                                    <p className={`font-bold ${diff < 0 ? "text-red-600" : diff > 0 ? "text-blue-600" : "text-slate-800"}`}>
                                                        {d.reportedStock}{d.product.unit || "個"}
                                                        <span className="text-xs ml-1">
                                                            ({diff > 0 ? "+" : ""}{diff})
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* 現在のリアルタイム在庫 */}
                                            <div className="flex items-center gap-2 text-sm">
                                                <Package className="w-4 h-4 text-slate-400" />
                                                <span className="text-slate-500">現在のDB在庫:</span>
                                                <span className="font-bold text-slate-900">
                                                    {d.product.stock}{d.product.unit || "個"}
                                                </span>
                                            </div>

                                            {/* メモ */}
                                            {d.note && (
                                                <div className="flex items-start gap-2 text-sm bg-white/80 rounded-lg p-2 border border-slate-200">
                                                    <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                                    <p className="text-slate-600 whitespace-pre-line">{d.note}</p>
                                                </div>
                                            )}

                                            {/* 処理済み日時 */}
                                            {d.resolvedAt && (
                                                <p className="text-xs text-green-600">
                                                    処理日時: {formatDate(d.resolvedAt)}
                                                </p>
                                            )}

                                            {/* 処理ボタン / メモ入力 */}
                                            {isPending && !isResolving && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-green-700 border-green-300 hover:bg-green-50"
                                                    onClick={() => setResolvingId(d.id)}
                                                >
                                                    <CheckCircle className="w-4 h-4 mr-1" />
                                                    処理済みにする
                                                </Button>
                                            )}

                                            {isResolving && (
                                                <div className="border-2 border-green-200 rounded-xl p-3 bg-green-50/50 space-y-2">
                                                    <input
                                                        type="text"
                                                        value={resolveNote}
                                                        onChange={(e) => setResolveNote(e.target.value)}
                                                        placeholder="処理メモ（任意）例: 棚卸で確認済み"
                                                        className="w-full h-10 text-sm border border-slate-300 rounded-lg px-3 focus:border-green-500 focus:outline-none"
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setResolvingId(null);
                                                                setResolveNote("");
                                                            }}
                                                        >
                                                            キャンセル
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700 text-white"
                                                            onClick={() => handleResolve(d.id)}
                                                            disabled={isPending && false}
                                                        >
                                                            {isPending ? (
                                                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                            ) : (
                                                                <CheckCircle className="w-4 h-4 mr-1" />
                                                            )}
                                                            確定
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
