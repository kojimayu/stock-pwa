"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Save, Loader2, MapPin, ArrowLeft, Lock, LockOpen, DollarSign } from "lucide-react";
import { toast } from "sonner";
import {
    getOrderEmailSettings,
    updateOrderEmailSetting,
    getDeliveryLocations,
    createDeliveryLocation,
    updateDeliveryLocation,
    deleteDeliveryLocation,
    getAirconProducts,
    updateAirconProductPrice,
} from "@/lib/aircon-actions";
import Link from "next/link";

interface AirconProd {
    id: number;
    code: string;
    name: string;
    suffix: string;
    capacity: string;
    orderPrice: number;
    priceA: number;
    priceB: number;
}

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

    // 単価管理
    const [products, setProducts] = useState<AirconProd[]>([]);
    const [priceEdits, setPriceEdits] = useState<Record<number, { orderPrice: string; priceA: string; priceB: string }>>({});
    const [priceLocked, setPriceLocked] = useState(true);
    const [savingPrices, setSavingPrices] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [settings, locs, prods] = await Promise.all([
                getOrderEmailSettings(),
                getDeliveryLocations(),
                getAirconProducts(),
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
            setProducts(prods as unknown as AirconProd[]);
            // 現在の単価を編集用にセット
            const edits: Record<number, { orderPrice: string; priceA: string; priceB: string }> = {};
            (prods as unknown as AirconProd[]).forEach(p => {
                edits[p.id] = {
                    orderPrice: String(p.orderPrice || 0),
                    priceA: String(p.priceA || 0),
                    priceB: String(p.priceB || 0),
                };
            });
            setPriceEdits(edits);
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

    // 単価保存
    const handleSavePrices = async () => {
        setSavingPrices(true);
        try {
            for (const product of products) {
                const edits = priceEdits[product.id];
                if (!edits) continue;
                const newOrderPrice = parseInt(edits.orderPrice || "0") || 0;
                const newPriceA = parseInt(edits.priceA || "0") || 0;
                const newPriceB = parseInt(edits.priceB || "0") || 0;
                if (newOrderPrice !== product.orderPrice || newPriceA !== product.priceA || newPriceB !== product.priceB) {
                    await updateAirconProductPrice(product.id, {
                        orderPrice: newOrderPrice,
                        priceA: newPriceA,
                        priceB: newPriceB,
                    });
                }
            }
            toast.success("単価を保存しました");
            setPriceLocked(true);
            fetchData();
        } catch {
            toast.error("単価の保存に失敗しました");
        } finally {
            setSavingPrices(false);
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

            {/* 単価管理 */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <DollarSign className="h-5 w-5" /> 発注単価管理
                            </CardTitle>
                            <CardDescription>注文書PDFに反映される発注単価を管理します</CardDescription>
                        </div>
                        <Button
                            variant={priceLocked ? "outline" : "destructive"}
                            size="sm"
                            onClick={() => setPriceLocked(!priceLocked)}
                        >
                            {priceLocked ? <><Lock className="h-4 w-4 mr-1" /> ロック中</> : <><LockOpen className="h-4 w-4 mr-1" /> 編集中</>}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="grid grid-cols-[1fr_80px_100px_100px_100px] gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span>品番 / 商品名</span>
                        <span>容量</span>
                        <span className="text-right">発注単価</span>
                        <span className="text-right">売価A（通常）</span>
                        <span className="text-right">売価B（特別）</span>
                    </div>
                    {products.map(product => (
                        <div key={product.id} className="grid grid-cols-[1fr_80px_100px_100px_100px] gap-2 items-center p-2 rounded border">
                            <div className="text-sm">
                                <span className="font-mono text-xs text-muted-foreground mr-2">{product.code}{product.suffix}</span>
                                {product.name}
                            </div>
                            <span className="text-sm text-muted-foreground">{product.capacity}</span>
                            <Input
                                type="number"
                                min={0}
                                step={100}
                                className="h-8 text-right"
                                value={priceEdits[product.id]?.orderPrice || "0"}
                                onChange={e => setPriceEdits({ ...priceEdits, [product.id]: { ...priceEdits[product.id], orderPrice: e.target.value } })}
                                disabled={priceLocked}
                            />
                            <Input
                                type="number"
                                min={0}
                                step={100}
                                className="h-8 text-right"
                                value={priceEdits[product.id]?.priceA || "0"}
                                onChange={e => setPriceEdits({ ...priceEdits, [product.id]: { ...priceEdits[product.id], priceA: e.target.value } })}
                                disabled={priceLocked}
                            />
                            <Input
                                type="number"
                                min={0}
                                step={100}
                                className="h-8 text-right"
                                value={priceEdits[product.id]?.priceB || "0"}
                                onChange={e => setPriceEdits({ ...priceEdits, [product.id]: { ...priceEdits[product.id], priceB: e.target.value } })}
                                disabled={priceLocked}
                            />
                        </div>
                    ))}
                    {!priceLocked && (
                        <Button onClick={handleSavePrices} disabled={savingPrices} className="w-full mt-3">
                            {savingPrices ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 保存中...</> : <><Save className="h-4 w-4 mr-1" /> 単価を保存</>}
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
