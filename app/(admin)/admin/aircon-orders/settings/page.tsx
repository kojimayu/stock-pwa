"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Save, Loader2, MapPin, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
    getOrderEmailSettings,
    updateOrderEmailSetting,
    getDeliveryLocations,
    createDeliveryLocation,
    updateDeliveryLocation,
    deleteDeliveryLocation,
} from "@/lib/aircon-actions";
import Link from "next/link";

interface EmailContact {
    name: string;
    company: string;
    email: string;
    department?: string;
    tel?: string;
}

interface DeliveryLoc {
    id: number;
    name: string;
    address: string | null;
    isActive: boolean;
}

export default function AirconOrderSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // メール設定
    const [toContact, setToContact] = useState<EmailContact>({
        name: "", company: "", department: "", email: "", tel: ""
    });
    const [ccList, setCcList] = useState<EmailContact[]>([]);
    const [fromCompany, setFromCompany] = useState("");

    // 拠点管理
    const [locations, setLocations] = useState<DeliveryLoc[]>([]);
    const [newLocationName, setNewLocationName] = useState("");
    const [newLocationAddress, setNewLocationAddress] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [settings, locs] = await Promise.all([
                getOrderEmailSettings(),
                getDeliveryLocations(),
            ]);
            if (settings["aircon_order_to"]) {
                setToContact(JSON.parse(settings["aircon_order_to"]));
            }
            if (settings["aircon_order_cc"]) {
                setCcList(JSON.parse(settings["aircon_order_cc"]));
            }
            if (settings["aircon_order_from_company"]) {
                setFromCompany(settings["aircon_order_from_company"]);
            }
            setLocations(locs);
        } catch {
            toast.error("設定の読み込みに失敗しました");
        } finally {
            setLoading(false);
        }
    };

    // メール設定保存
    const handleSaveEmail = async () => {
        setSaving(true);
        try {
            await updateOrderEmailSetting("aircon_order_to", JSON.stringify(toContact));
            await updateOrderEmailSetting("aircon_order_cc", JSON.stringify(ccList));
            await updateOrderEmailSetting("aircon_order_from_company", fromCompany);
            toast.success("メール設定を保存しました");
        } catch {
            toast.error("保存に失敗しました");
        } finally {
            setSaving(false);
        }
    };

    // CCリスト操作
    const addCc = () => {
        setCcList([...ccList, { name: "", company: "", email: "" }]);
    };
    const removeCc = (idx: number) => {
        setCcList(ccList.filter((_, i) => i !== idx));
    };
    const updateCc = (idx: number, field: keyof EmailContact, value: string) => {
        const updated = [...ccList];
        updated[idx] = { ...updated[idx], [field]: value };
        setCcList(updated);
    };

    // 拠点操作
    const handleAddLocation = async () => {
        if (!newLocationName.trim()) {
            toast.error("拠点名を入力してください");
            return;
        }
        const result = await createDeliveryLocation(newLocationName.trim(), newLocationAddress.trim() || undefined);
        if (result.success) {
            toast.success("拠点を追加しました");
            setNewLocationName("");
            setNewLocationAddress("");
            fetchData();
        }
    };

    const handleToggleLocation = async (loc: DeliveryLoc) => {
        await updateDeliveryLocation(loc.id, { isActive: !loc.isActive });
        toast.success(loc.isActive ? "拠点を無効化しました" : "拠点を有効化しました");
        fetchData();
    };

    const handleDeleteLocation = async (loc: DeliveryLoc) => {
        const result = await deleteDeliveryLocation(loc.id);
        if (result.success) {
            toast.success("拠点を削除しました");
            fetchData();
        } else {
            toast.error(result.message);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/admin/aircon-orders">
                    <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">発注設定</h2>
                    <p className="text-muted-foreground">メール送信先とCC、納品先拠点の管理</p>
                </div>
            </div>

            {/* 送信先（To）設定 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">📧 送信先（To）</CardTitle>
                    <CardDescription>発注メールの宛先</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground">会社名</label>
                            <Input value={toContact.company} onChange={e => setToContact({ ...toContact, company: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">部署</label>
                            <Input value={toContact.department || ""} onChange={e => setToContact({ ...toContact, department: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground">担当者名</label>
                            <Input value={toContact.name} onChange={e => setToContact({ ...toContact, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">メールアドレス</label>
                            <Input value={toContact.email} onChange={e => setToContact({ ...toContact, email: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">電話番号</label>
                            <Input value={toContact.tel || ""} onChange={e => setToContact({ ...toContact, tel: e.target.value })} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* CC設定 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">📋 CC（同報先）</CardTitle>
                    <CardDescription>発注メールのCC</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {ccList.map((cc, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <Input
                                className="flex-1"
                                placeholder="氏名"
                                value={cc.name}
                                onChange={e => updateCc(idx, "name", e.target.value)}
                            />
                            <Input
                                className="flex-1"
                                placeholder="会社名"
                                value={cc.company}
                                onChange={e => updateCc(idx, "company", e.target.value)}
                            />
                            <Input
                                className="flex-[2]"
                                placeholder="メールアドレス"
                                value={cc.email}
                                onChange={e => updateCc(idx, "email", e.target.value)}
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeCc(idx)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addCc}>
                        <Plus className="h-4 w-4 mr-1" /> CC追加
                    </Button>
                </CardContent>
            </Card>

            {/* 差出元 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">🏢 差出元会社名</CardTitle>
                </CardHeader>
                <CardContent>
                    <Input value={fromCompany} onChange={e => setFromCompany(e.target.value)} placeholder="㈱プラスカンパニー" />
                </CardContent>
            </Card>

            {/* 保存ボタン */}
            <Button onClick={handleSaveEmail} disabled={saving} className="w-full">
                {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 保存中...</> : <><Save className="h-4 w-4 mr-1" /> メール設定を保存</>}
            </Button>

            {/* 納品先拠点 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <MapPin className="h-5 w-5" /> 納品先拠点
                    </CardTitle>
                    <CardDescription>発注時に選択する納品先拠点の管理</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {locations.map(loc => (
                        <div key={loc.id} className={`flex items-center gap-3 p-3 border rounded ${!loc.isActive ? "opacity-50" : ""}`}>
                            <div className="flex-1">
                                <span className="font-medium">{loc.name}</span>
                                {loc.address && <span className="text-xs text-muted-foreground ml-2">{loc.address}</span>}
                                {!loc.isActive && <span className="text-xs text-red-500 ml-2">（無効）</span>}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleToggleLocation(loc)}>
                                {loc.isActive ? "無効化" : "有効化"}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteLocation(loc)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                    <div className="flex gap-2">
                        <Input
                            value={newLocationName}
                            onChange={e => setNewLocationName(e.target.value)}
                            placeholder="拠点名"
                            className="flex-1"
                        />
                        <Input
                            value={newLocationAddress}
                            onChange={e => setNewLocationAddress(e.target.value)}
                            placeholder="住所（任意）"
                            className="flex-1"
                        />
                        <Button onClick={handleAddLocation}>
                            <Plus className="h-4 w-4 mr-1" /> 追加
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
