"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Printer, Download, CheckCircle, Loader2, Lock, Eye } from "lucide-react";
import { isMonthClosed, getMonthlyCloseInfo } from "@/lib/actions";

type GenerateResult = {
    success: boolean;
    files: { vendor: string; type: string; file: string; url: string; subtotal: number; tax: number; total: number }[];
    csvUrl: string;
    vendorCount: number;
    grandTotal: number;
    closed: boolean;
};

export default function StatementsPage() {
    const router = useRouter();
    const now = new Date();
    const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();

    const [year, setYear] = useState(String(defaultYear));
    const [month, setMonth] = useState(String(defaultMonth));
    const [closed, setClosed] = useState<{ closedAt: Date; closedBy: string | null } | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<GenerateResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 締め状態チェック
    useEffect(() => {
        async function check() {
            setLoading(true);
            setResult(null);
            setError(null);
            try {
                const info = await getMonthlyCloseInfo(Number(year), Number(month));
                setClosed(info ? { closedAt: info.closedAt, closedBy: info.closedBy } : null);
            } catch {
                setClosed(null);
            }
            setLoading(false);
        }
        check();
    }, [year, month]);

    const handlePreview = () => {
        router.push(`/admin/reports/statements/print?year=${year}&month=${month}`);
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        setResult(null);
        try {
            const res = await fetch("/api/statements/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ year: Number(year), month: Number(month) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "生成に失敗しました");
            setResult(data);
            setClosed({ closedAt: new Date(), closedBy: null });
        } catch (e) {
            setError(e instanceof Error ? e.message : "エラーが発生しました");
        }
        setGenerating(false);
    };

    const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">月次明細書</h2>
                <p className="text-muted-foreground">業者ごとの月次取引明細をPDF出力・月次締め</p>
            </div>

            <Card className="max-w-2xl">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        対象期間
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-end gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">年</label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map((y) => (
                                        <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">月</label>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger className="w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map((m) => (
                                        <SelectItem key={m} value={String(m)}>{m}月</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        ) : closed ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium bg-emerald-50 px-3 py-1.5 rounded-full">
                                <Lock className="w-4 h-4" />
                                締め済み
                                <span className="text-xs text-emerald-500 ml-1">
                                    {new Date(closed.closedAt).toLocaleDateString("ja-JP")}
                                </span>
                            </div>
                        ) : (
                            <div className="text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full font-medium">
                                未締め
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" onClick={handlePreview} className="gap-2">
                            <Eye className="w-4 h-4" />
                            プレビュー
                        </Button>
                        <Button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="gap-2"
                        >
                            {generating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            {closed ? "再出力（上書き）" : "PDF出力＋月次締め"}
                        </Button>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            ⚠ {error}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 出力結果 */}
            {result && (
                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            出力完了 — {result.vendorCount}社
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left">
                                        <th className="py-2 font-medium">業者名</th>
                                        <th className="py-2 font-medium">種別</th>
                                        <th className="py-2 font-medium text-right">税込合計</th>
                                        <th className="py-2 font-medium text-right">PDF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.files.map((f, i) => (
                                        <tr key={i} className="border-b last:border-0">
                                            <td className="py-2">{f.vendor}</td>
                                            <td className="py-2">{f.type}</td>
                                            <td className="py-2 text-right">¥{f.total.toLocaleString()}</td>
                                            <td className="py-2 text-right">
                                                <a href={f.url} target="_blank" className="text-blue-600 hover:underline text-xs">
                                                    📄 開く
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 font-bold">
                                        <td className="py-2" colSpan={2}>合計</td>
                                        <td className="py-2 text-right">¥{result.grandTotal.toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <a
                            href={result.csvUrl}
                            target="_blank"
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                            📊 チェックリスト（CSV）をダウンロード
                        </a>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
