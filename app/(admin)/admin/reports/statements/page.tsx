"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, CheckCircle, Loader2, Lock, Eye, LockOpen, ShieldCheck } from "lucide-react";
import { getMonthlyCloseInfo, finalizeMonth, reopenMonth } from "@/lib/actions";

type GenerateResult = {
    success: boolean;
    files: { vendor: string; type: string; file: string; url: string; subtotal: number; tax: number; total: number }[];
    csvUrl: string;
    zipUrl?: string;
    vendorCount: number;
    grandTotal: number;
    closed: boolean;
    closedAt?: string;
};

type CloseInfo = { status: string; closedAt: Date; closedBy: string | null } | null;

export default function StatementsPage() {
    const router = useRouter();
    const now = new Date();
    const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();

    const [year, setYear] = useState(String(defaultYear));
    const [month, setMonth] = useState(String(defaultMonth));
    const [closeInfo, setCloseInfo] = useState<CloseInfo>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<GenerateResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refreshCloseInfo = async () => {
        setLoading(true);
        setResult(null);
        setError(null);
        try {
            const info = await getMonthlyCloseInfo(Number(year), Number(month));
            setCloseInfo(info ? { status: info.status, closedAt: info.closedAt, closedBy: info.closedBy } : null);
        } catch {
            setCloseInfo(null);
        }
        setLoading(false);
    };

    useEffect(() => { refreshCloseInfo(); }, [year, month]);

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
            await refreshCloseInfo();
        } catch (e) {
            setError(e instanceof Error ? e.message : "エラーが発生しました");
        }
        setGenerating(false);
    };

    const handleFinalize = async () => {
        if (!confirm(`${year}年${month}月を本締めしますか？\n本締め後は取引の編集・返品ができなくなります。`)) return;
        try {
            await finalizeMonth(Number(year), Number(month));
            await refreshCloseInfo();
        } catch (e) {
            setError(e instanceof Error ? e.message : "本締めに失敗しました");
        }
    };

    const handleReopen = async () => {
        if (!confirm(`${year}年${month}月の仮締めを解除しますか？\n解除後、取引の編集が可能になります。`)) return;
        try {
            await reopenMonth(Number(year), Number(month));
            await refreshCloseInfo();
        } catch (e) {
            setError(e instanceof Error ? e.message : "解除に失敗しました");
        }
    };

    const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const isDraft = closeInfo?.status === "DRAFT";
    const isFinal = closeInfo?.status === "FINAL";
    const isClosed = !!closeInfo;

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
                                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
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
                                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {months.map((m) => (
                                        <SelectItem key={m} value={String(m)}>{m}月</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        ) : isFinal ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 text-sm font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                                <ShieldCheck className="w-4 h-4" />
                                本締め済
                                <span className="text-xs text-emerald-500 ml-1">
                                {new Date(closeInfo!.closedAt).toLocaleDateString("ja-JP")}
                                {' '}{new Date(closeInfo!.closedAt).toLocaleTimeString("ja-JP", { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ) : isDraft ? (
                            <div className="flex items-center gap-1.5 text-amber-700 text-sm font-semibold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                                <Lock className="w-4 h-4" />
                                仮締め
                                <span className="text-xs text-amber-500 ml-1">
                                {new Date(closeInfo!.closedAt).toLocaleDateString("ja-JP")}
                                {' '}{new Date(closeInfo!.closedAt).toLocaleTimeString("ja-JP", { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
                                未締め
                            </div>
                        )}
                    </div>

                    {/* 業務フロー説明 */}
                    <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 space-y-1">
                        <p><strong>業務フロー:</strong></p>
                        <p>① <strong>仮締め</strong>（5日頃）→ PDF出力・業者へ送付。取引ロック開始</p>
                        <p>② 業者確認 → 問題あれば仮締め解除→修正→再仮締め</p>
                        <p>③ <strong>本締め</strong>（10日頃）→ 確定。解除不可</p>
                    </div>

                    <div className="flex gap-3 pt-2 flex-wrap">
                        <Button variant="outline" onClick={handlePreview} className="gap-2">
                            <Eye className="w-4 h-4" />
                            プレビュー
                        </Button>

                        {!isFinal && (
                            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                                {generating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                {isClosed ? "再出力（上書き）" : "PDF出力＋仮締め"}
                            </Button>
                        )}

                        {isDraft && (
                            <>
                                <Button variant="default" onClick={handleFinalize} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                    <ShieldCheck className="w-4 h-4" />
                                    本締め
                                </Button>
                                <Button variant="outline" onClick={handleReopen} className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50">
                                    <LockOpen className="w-4 h-4" />
                                    仮締め解除
                                </Button>
                            </>
                        )}
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
                        {result.closedAt && (
                            <p className="text-sm text-slate-500 mt-1">締め日時: <strong>{result.closedAt}</strong></p>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-white">
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

                        <div className="flex gap-3 flex-wrap">
                            {result.zipUrl && (
                                <a
                                    href={result.zipUrl}
                                    download
                                    className="inline-flex items-center gap-2 text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    📦 ZIP一括ダウンロード
                                </a>
                            )}
                            <a
                                href={result.csvUrl}
                                target="_blank"
                                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                            >
                                📊 チェックリスト（CSV）
                            </a>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
