"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store"; // Assuming vendor is here
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Search, Check } from "lucide-react";
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

    // States
    const [managementNo, setManagementNo] = useState("");
    const [jobInfo, setJobInfo] = useState<AccessJobInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [modelNumber, setModelNumber] = useState("");
    const [isManualInput, setIsManualInput] = useState(false);
    const [saving, setSaving] = useState(false);

    // If not logged in, redirect (simple check)
    useEffect(() => {
        if (!vendor) {
            router.push("/");
        }
    }, [vendor, router]);

    if (!vendor) return null; // or loading

    const handleSearch = async () => {
        if (!managementNo || managementNo.length < 6) {
            toast.error("管理Noは6桁以上で入力してください");
            return;
        }

        setLoading(true);
        setJobInfo(null);
        try {
            // Pass vendor name for filtering
            const res = await fetch(`/api/access?managementNo=${managementNo}&vendorName=${encodeURIComponent(vendor.name)}`);
            const data = await res.json();

            if (!res.ok || !data.success || !data.data) {
                // If filtered out, it defaults to Not Found or error
                toast.error("データが見つかりません。担当外の可能性があります。");
                return;
            }

            setJobInfo(data.data);
            toast.success("物件情報を取得しました");

            // Reset input state on new search
            setModelNumber("");
            setIsManualInput(false);

        } catch (e) {
            toast.error("検索エラーが発生しました");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!jobInfo || !modelNumber) return;

        setSaving(true);
        try {
            const res = await fetch("/api/aircon/transaction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    managementNo: jobInfo.管理No,
                    customerName: jobInfo.顧客名,
                    contractor: jobInfo.SubContractor || jobInfo.PrimeContractor,
                    modelNumber,
                    vendorId: vendor.id,
                }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
                toast.success("持出し記録を保存しました");
                router.push("/mode-select");
            } else {
                toast.error("保存に失敗しました");
            }
        } catch (e) {
            toast.error("システムエラー");
        } finally {
            setSaving(false);
        }
    };

    // Capacity Display Helper
    const renderCapacities = () => {
        if (!jobInfo) return null;
        const capacities = ["22kw", "25kw", "28kw", "36kw", "40kw"];
        const needed = capacities.filter(c => Number(jobInfo[c]) > 0);

        if (needed.length === 0) return <span className="text-slate-400">指定なし</span>;

        return (
            <div className="flex gap-2 flex-wrap">
                {needed.map(c => (
                    <span key={c} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-bold">
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
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" className="text-white p-0 mr-2" onClick={() => router.push("/mode-select")}>
                        <ChevronLeft />
                    </Button>
                    <h1 className="text-lg font-bold">エアコン持出し</h1>
                </div>
                <LogoutButton />
            </header>

            <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-6">

                {/* Search Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>物件検索</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="管理No (例: 123456)"
                                value={managementNo}
                                onChange={(e) => setManagementNo(e.target.value)}
                                className="text-lg h-12"
                                type="tel" // Number pad
                            />
                            <Button onClick={handleSearch} disabled={loading} className="h-12 px-6">
                                {loading ? <Loader2 className="animate-spin" /> : <Search />}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Info & Action Section */}
                {jobInfo && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <Card className="bg-white border-blue-200 shadow-md">
                            <CardHeader className="bg-blue-50 border-b border-blue-100 pb-2">
                                <CardTitle className="text-blue-900 text-lg flex justify-between">
                                    <span>{jobInfo.顧客名} 様邸</span>
                                    <span className="text-sm font-normal text-blue-600">No. {jobInfo.管理No}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-2">
                                <div className="grid grid-cols-3 gap-2 text-sm">
                                    <span className="text-slate-500">業者名</span>
                                    <span className="col-span-2 font-medium">{jobInfo.SubContractor || jobInfo.PrimeContractor || "-"}</span>

                                    <span className="text-slate-500">必要能力</span>
                                    <div className="col-span-2">
                                        {renderCapacities()}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>持出し情報の入力</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">

                                <div className="space-y-4">
                                    <label className="text-sm font-medium text-slate-700">エアコン品番を選択</label>

                                    <div className="grid grid-cols-2 gap-3">
                                        {PRESETS.map((p) => (
                                            <Button
                                                key={p.model}
                                                variant={modelNumber === p.model && !isManualInput ? "default" : "outline"}
                                                className={`h-16 text-lg font-bold flex flex-col gap-1 ${modelNumber === p.model && !isManualInput
                                                        ? "bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-300 ring-offset-2"
                                                        : "hover:bg-slate-50"
                                                    }`}
                                                onClick={() => {
                                                    setModelNumber(p.model);
                                                    setIsManualInput(false);
                                                }}
                                            >
                                                <span>{p.label}</span>
                                                <span className="text-xs font-normal opacity-80">{p.model}</span>
                                            </Button>
                                        ))}
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setIsManualInput(true);
                                            setModelNumber("");
                                        }}
                                        className={`w-full text-slate-500 ${isManualInput ? "bg-slate-100" : ""}`}
                                    >
                                        {isManualInput ? "▼ 手入力中" : "その他の品番を入力する"}
                                    </Button>

                                    {isManualInput && (
                                        <div className="animate-in fade-in slide-in-from-top-2">
                                            <Input
                                                placeholder="例: RAS-AJ4025S"
                                                value={modelNumber}
                                                onChange={(e) => setModelNumber(e.target.value)}
                                                className="h-14 text-lg"
                                            />
                                        </div>
                                    )}
                                </div>

                                <Button
                                    className="w-full h-16 text-xl font-bold bg-blue-600 hover:bg-blue-700 mt-4"
                                    onClick={handleSubmit}
                                    disabled={!modelNumber || saving}
                                >
                                    {saving ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />}
                                    持出しを確定する
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>
        </div>
    );
}
