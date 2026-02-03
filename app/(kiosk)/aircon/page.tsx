"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Search, Check, Trash2 } from "lucide-react";
import { LogoutButton } from "@/components/kiosk/logout-button";

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

export default function AirconPage() {
    const router = useRouter();
    const vendor = useCartStore((state) => state.vendor);

    const [managementNo, setManagementNo] = useState("");
    const [jobInfo, setJobInfo] = useState<AccessJobInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [manualInputModel, setManualInputModel] = useState("");
    const [isManualInput, setIsManualInput] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!vendor) {
            router.push("/");
        }
    }, [vendor, router]);

    if (!vendor) return null;

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

    const addItem = (model: string) => {
        setSelectedItems((prev) => [...prev, model]);
    };

    const removeItem = (index: number) => {
        setSelectedItems((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!jobInfo || selectedItems.length === 0) return;

        setSaving(true);
        try {
            const res = await fetch("/api/aircon/transaction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    managementNo: String(jobInfo.管理No),
                    customerName: jobInfo.顧客名,
                    contractor: jobInfo.SubContractor || jobInfo.PrimeContractor,
                    items: selectedItems,
                    vendorId: vendor.id,
                }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
                toast.success(`${data.count}件の持出しを記録しました`);
                router.push("/mode-select");
            } else {
                toast.error(`保存に失敗しました: ${data.details || data.error || "不明なエラー"}`);
            }
        } catch (e) {
            toast.error("システムエラー");
        } finally {
            setSaving(false);
        }
    };

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

    const PRESETS = [
        { label: "2.2kw", model: "RAS-AJ2225S" },
        { label: "2.5kw", model: "RAS-AJ2525S" },
        { label: "2.8kw", model: "RAS-AJ2825S" },
        { label: "3.6kw", model: "RAS-AJ3625S" },
    ];

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between flex-shrink-0">
                <Button variant="ghost" size="sm" className="text-white h-10 px-3" onClick={() => router.push("/mode-select")}>
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    戻る
                </Button>
                <div className="flex items-center gap-2">
                    <h1 className="text-base font-bold">エアコン持出し</h1>
                    <span className="text-slate-400">|</span>
                    <span className="text-sm text-slate-300">
                        {vendor ? `${vendor.name} 様` : ""}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-slate-800"
                        onClick={() => router.push("/aircon/history")}
                    >
                        履歴
                    </Button>
                    <LogoutButton />
                </div>
            </header>

            {/* Main - 2カラムレイアウト */}
            <main className="flex-1 p-2 overflow-hidden">
                <div className="h-full grid grid-cols-2 gap-2">

                    {/* ===== 左カラム: 検索 + 物件情報 ===== */}
                    <div className="flex flex-col gap-2 min-h-0">
                        {/* 検索セクション */}
                        <Card className="flex-shrink-0">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-sm">管理No検索</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 pt-0">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="6桁の管理No"
                                        value={managementNo}
                                        onChange={(e) => setManagementNo(e.target.value)}
                                        className="text-xl h-12 font-mono"
                                        type="tel"
                                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                    />
                                    <Button onClick={handleSearch} disabled={loading} className="h-12 px-4">
                                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 物件情報 */}
                        <Card className={`flex-1 min-h-0 overflow-auto ${jobInfo ? 'border-blue-300 bg-blue-50' : ''}`}>
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
                                        <div className="bg-amber-100 border border-amber-300 text-amber-800 text-xs p-2 rounded">
                                            ⚠ 依頼書と照合してください
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

                    {/* ===== 右カラム: 持出しリスト + 機種選択 + 確定ボタン ===== */}
                    <div className={`flex flex-col gap-2 min-h-0 ${!jobInfo ? 'opacity-40 pointer-events-none' : ''}`}>

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
                                        {selectedItems.map((item, index) => (
                                            <li key={index} className="flex justify-between items-center bg-slate-50 border p-2 rounded">
                                                <span className="font-mono font-medium">{item}</span>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => removeItem(index)}
                                                    className="h-7 px-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>

                        {/* 機種選択ボタン */}
                        <Card className="flex-shrink-0">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-sm">機種選択</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 pt-0 space-y-2">
                                <div className="grid grid-cols-4 gap-2">
                                    {PRESETS.map((p) => (
                                        <Button
                                            key={p.model}
                                            variant="outline"
                                            className="h-12 text-sm font-bold flex flex-col gap-0 hover:bg-blue-50 hover:border-blue-400"
                                            onClick={() => addItem(p.model)}
                                            disabled={!jobInfo}
                                        >
                                            <span className="text-base">{p.label}</span>
                                        </Button>
                                    ))}
                                </div>

                                {/* 手動入力 */}
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
