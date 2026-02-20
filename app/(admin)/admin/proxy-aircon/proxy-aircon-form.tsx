"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Search, Check, Trash2 } from "lucide-react";

interface Vendor {
    id: number;
    name: string;
}

interface AccessJobInfo {
    管理No: string;
    顧客名: string;
    SubContractor?: string;
    PrimeContractor?: string;
    "22kw"?: number;
    "25kw"?: number;
    "28kw"?: number;
    "36kw"?: number;
    "40kw"?: number;
    [key: string]: string | number | undefined;
}

interface ProxyAirconFormProps {
    vendor: Vendor;
    onComplete: () => void;
}

// エアコン代理入力フォーム
// Kiosk版の aircon/page.tsx をベースに管理画面用に適応
export function ProxyAirconForm({ vendor, onComplete }: ProxyAirconFormProps) {
    // 引取日（代理入力用：過去日付を指定可能）
    const [transactionDate, setTransactionDate] = useState(
        new Date().toISOString().split("T")[0] // デフォルトは今日
    );

    const [managementNo, setManagementNo] = useState("");
    const [jobInfo, setJobInfo] = useState<AccessJobInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [manualInputModel, setManualInputModel] = useState("");
    const [isManualInput, setIsManualInput] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedType, setSelectedType] = useState<"SET" | "INDOOR" | "OUTDOOR">("SET");

    // 管理No検索
    const handleSearch = async () => {
        if (!managementNo || managementNo.length < 6) {
            toast.error("管理Noは6桁以上で入力してください");
            return;
        }

        setLoading(true);
        setJobInfo(null);
        try {
            const res = await fetch(`/api/access?managementNo=${managementNo}&vendorName=${encodeURIComponent(vendor.name)}`);
            const data = await res.json();

            if (!res.ok || !data.success || !data.data) {
                toast.error("データが見つかりません。担当外の可能性があります。");
                return;
            }

            setJobInfo(data.data);
            toast.success("物件情報を取得しました");
            setSelectedItems([]);
            setManualInputModel("");
            setIsManualInput(false);
        } catch (e) {
            toast.error("検索エラーが発生しました");
        } finally {
            setLoading(false);
        }
    };

    // アイテム追加/削除
    const addItem = (model: string) => {
        setSelectedItems((prev) => [...prev, JSON.stringify({ model, type: selectedType })]);
    };

    const removeItem = (index: number) => {
        setSelectedItems((prev) => prev.filter((_, i) => i !== index));
    };

    // 持出し確定
    const handleSubmit = async () => {
        if (!jobInfo || selectedItems.length === 0) return;

        setSaving(true);
        try {
            const parsedItems = selectedItems.map(item => JSON.parse(item));

            // タイプ別にグループ化
            const itemsByType: Record<string, string[]> = {};
            parsedItems.forEach(({ model, type }: { model: string; type: string }) => {
                if (!itemsByType[type]) itemsByType[type] = [];
                itemsByType[type].push(model);
            });

            let totalCount = 0;
            for (const [type, models] of Object.entries(itemsByType)) {
                const res = await fetch("/api/aircon/transaction", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        managementNo: String(jobInfo.管理No),
                        customerName: jobInfo.顧客名,
                        contractor: jobInfo.SubContractor || jobInfo.PrimeContractor,
                        items: models,
                        vendorId: vendor.id,
                        type: type,
                        isProxyInput: true, // 代理入力フラグ
                        // 代理入力用：引取日を指定
                        transactionDate: transactionDate,
                    }),
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    totalCount += data.count;
                } else {
                    if (data.error || data.details) {
                        toast.error(`エラー: ${data.details || data.error}`);
                    }
                }
            }

            if (totalCount > 0) {
                toast.success(`${totalCount}件の持出しを記録しました（代理入力）`);
                onComplete();
            }
        } catch (e) {
            toast.error("システムエラー");
        } finally {
            setSaving(false);
        }
    };

    // 容量表示
    const renderCapacities = () => {
        if (!jobInfo) return null;
        const capacities = ["22kw", "25kw", "28kw", "36kw", "40kw"];
        const needed = capacities.filter(c => Number(jobInfo[c]) > 0);

        if (needed.length === 0) return <span className="text-slate-400">指定なし</span>;

        return (
            <div className="flex gap-1 flex-wrap">
                {needed.map(c => (
                    <span key={c} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">
                        {c}: {jobInfo[c]}台
                    </span>
                ))}
            </div>
        );
    };

    // プリセット機種
    const PRESETS = [
        { label: "2.2kw", model: "RAS-AJ2225S" },
        { label: "2.5kw", model: "RAS-AJ2525S" },
        { label: "2.8kw", model: "RAS-AJ2825S" },
        { label: "3.6kw", model: "RAS-AJ3625S" },
    ];

    const parseItem = (jsonStr: string) => JSON.parse(jsonStr) as { model: string; type: "SET" | "INDOOR" | "OUTDOOR" };

    return (
        <div className="h-full bg-slate-100 flex flex-col overflow-hidden">
            <main className="flex-1 p-3 overflow-hidden">
                <div className="h-full grid grid-cols-2 gap-3">

                    {/* 左カラム: 引取日 + 管理No検索 + 物件情報 */}
                    <div className="flex flex-col gap-3 min-h-0">
                        {/* 引取日入力（代理入力用） */}
                        <Card className="flex-shrink-0 border-amber-300 bg-amber-50">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-sm text-amber-800">引取日</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 pt-0">
                                <Input
                                    type="date"
                                    value={transactionDate}
                                    onChange={(e) => setTransactionDate(e.target.value)}
                                    className="h-10 text-lg font-mono bg-white"
                                />
                            </CardContent>
                        </Card>

                        {/* 管理No検索 */}
                        <Card className="flex-shrink-0">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-sm">管理No検索</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 pt-0">
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="6桁の管理No"
                                            value={managementNo}
                                            onChange={(e) => setManagementNo(e.target.value)}
                                            className="text-lg h-10 font-mono"
                                            type="tel"
                                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                            disabled={loading || managementNo === "INTERNAL"}
                                        />
                                        <Button onClick={handleSearch} disabled={loading || managementNo === "INTERNAL"} className="h-10 px-4">
                                            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
                                        </Button>
                                    </div>

                                    <Button
                                        variant={managementNo === "INTERNAL" ? "secondary" : "outline"}
                                        onClick={() => {
                                            if (managementNo === "INTERNAL") {
                                                setManagementNo("");
                                                setJobInfo(null);
                                            } else {
                                                setManagementNo("INTERNAL");
                                                setJobInfo({
                                                    管理No: "INTERNAL",
                                                    顧客名: "自社在庫(予備)",
                                                    SubContractor: "自社在庫",
                                                    PrimeContractor: "自社在庫"
                                                });
                                                toast.success("自社在庫モードに切り替えました");
                                            }
                                        }}
                                        className={`w-full text-xs border-dashed ${managementNo === "INTERNAL" ? "bg-slate-200 border-slate-400" : "text-slate-500 hover:text-slate-700"}`}
                                        size="sm"
                                    >
                                        {managementNo === "INTERNAL" ? "通常モードに戻す" : "管理Noなし（予備・自社在庫）として登録"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 物件情報 */}
                        <Card className={`flex-1 min-h-0 overflow-auto ${jobInfo ? "border-blue-300 bg-blue-50" : ""}`}>
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-sm">物件情報</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 pt-0">
                                {jobInfo ? (
                                    <div className="space-y-2">
                                        <div className="bg-white rounded p-3 border">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-bold text-lg text-blue-900">{jobInfo.顧客名} 様邸</span>
                                                <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded">No. {jobInfo.管理No}</span>
                                            </div>
                                            <div className="grid grid-cols-[60px_1fr] gap-1 text-sm">
                                                <span className="text-slate-500">業者</span>
                                                <span className="font-medium">{jobInfo.SubContractor || jobInfo.PrimeContractor || "-"}</span>
                                                <span className="text-slate-500">発注</span>
                                                <div>{renderCapacities()}</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 py-8">
                                        <div className="text-center">
                                            <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">管理Noで検索してください</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* 右カラム: 持出しリスト + 機種選択 + 確定ボタン */}
                    <div className={`flex flex-col gap-3 min-h-0 ${!jobInfo ? "opacity-40 pointer-events-none" : ""}`}>

                        {/* 持出しリスト */}
                        <Card className="flex-1 min-h-0 flex flex-col">
                            <CardHeader className="py-2 px-3 flex-shrink-0 border-b flex flex-row items-center justify-between">
                                <CardTitle className="text-sm">持出しリスト</CardTitle>
                                <span className="bg-blue-600 text-white text-sm px-2 py-0.5 rounded font-bold">
                                    {selectedItems.length} 台
                                </span>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto p-2">
                                {selectedItems.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                        ↓ 下の機種ボタンで追加
                                    </div>
                                ) : (
                                    <ul className="space-y-1">
                                        {selectedItems.map((itemStr, index) => {
                                            const item = parseItem(itemStr);
                                            return (
                                                <li key={index} className="flex justify-between items-center bg-slate-50 border p-2 rounded">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] px-1 rounded border ${item.type === "SET" ? "bg-slate-100 text-slate-600 border-slate-300" :
                                                            item.type === "INDOOR" ? "bg-blue-100 text-blue-600 border-blue-300" :
                                                                "bg-orange-100 text-orange-600 border-orange-300"
                                                            }`}>
                                                            {item.type === "SET" ? "セット" : item.type === "INDOOR" ? "内機" : "外機"}
                                                        </span>
                                                        <span className="font-mono font-medium">{item.model}</span>
                                                    </div>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => removeItem(index)}
                                                        className="h-7 px-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>

                        {/* 機種選択 */}
                        <Card className="flex-shrink-0">
                            <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm">機種選択</CardTitle>
                                <div className="flex bg-slate-100 rounded p-1">
                                    {(["SET", "INDOOR", "OUTDOOR"] as const).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setSelectedType(t)}
                                            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${selectedType === t
                                                ? "bg-white shadow text-slate-900"
                                                : "text-slate-400 hover:text-slate-600"
                                                }`}
                                        >
                                            {t === "SET" ? "セット" : t === "INDOOR" ? "内機" : "外機"}
                                        </button>
                                    ))}
                                </div>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 pt-0 space-y-2">
                                <div className="grid grid-cols-4 gap-2">
                                    {PRESETS.map((p) => (
                                        <Button
                                            key={p.model}
                                            variant="outline"
                                            className={`h-12 text-sm font-bold flex flex-col gap-0 hover:bg-blue-50 hover:border-blue-400 ${selectedType === "INDOOR" ? "border-blue-200 bg-blue-50/50" :
                                                selectedType === "OUTDOOR" ? "border-orange-200 bg-orange-50/50" : ""
                                                }`}
                                            onClick={() => addItem(p.model)}
                                            disabled={!jobInfo}
                                        >
                                            <span className="text-base">{p.label}</span>
                                        </Button>
                                    ))}
                                </div>

                                {isManualInput ? (
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="品番を入力"
                                            value={manualInputModel}
                                            onChange={(e) => setManualInputModel(e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                        <Button
                                            onClick={() => {
                                                if (manualInputModel) {
                                                    addItem(manualInputModel);
                                                    setManualInputModel("");
                                                }
                                            }}
                                            disabled={!manualInputModel}
                                            size="sm"
                                            className="h-9"
                                        >
                                            追加
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsManualInput(false)}
                                            className="h-9"
                                        >
                                            ×
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsManualInput(true)}
                                        className="w-full text-slate-500 text-xs h-7"
                                        disabled={!jobInfo}
                                    >
                                        その他の品番を入力
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        {/* 確定ボタン */}
                        <Button
                            className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 flex-shrink-0 shadow-lg"
                            onClick={handleSubmit}
                            disabled={selectedItems.length === 0 || saving || !jobInfo}
                        >
                            {saving ? (
                                <Loader2 className="animate-spin mr-2 w-6 h-6" />
                            ) : (
                                <Check className="mr-2 w-6 h-6" />
                            )}
                            持出し確定 ({selectedItems.length}台)
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}
