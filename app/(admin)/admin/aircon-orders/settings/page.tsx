"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Save, Loader2, MapPin, ArrowLeft, Lock, LockOpen, DollarSign, Package, Tag, Settings } from "lucide-react";
import { toast } from "sonner";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    getOrderEmailSettings,
    updateOrderEmailSetting,
    getDeliveryLocations,
    createDeliveryLocation,
    updateDeliveryLocation,
    deleteDeliveryLocation,
    getAirconProducts,
    updateAirconProductPrice,
    updateAirconMinStock,
    updateAirconProductSuffix,
} from "@/lib/aircon-actions";
import Link from "next/link";

interface AirconProd {
    id: number;
    code: string;
    name: string;
    suffix: string;
    capacity: string;
    orderPrice: number;
    minStock: number;
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

    // 商品設定（統合）
    const [products, setProducts] = useState<AirconProd[]>([]);
    const [priceEdits, setPriceEdits] = useState<Record<number, { orderPrice: string }>>({});
    const [minStockEdits, setMinStockEdits] = useState<Record<number, string>>({});
    const [suffixEdits, setSuffixEdits] = useState<Record<number, string>>({});
    const [productLocked, setProductLocked] = useState(true);
    const [savingProducts, setSavingProducts] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

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
            const edits: Record<number, { orderPrice: string }> = {};
            (prods as unknown as AirconProd[]).forEach(p => {
                edits[p.id] = {
                    orderPrice: String(p.orderPrice || 0),
                };
            });
            setPriceEdits(edits);
            // 最低在庫を編集用にセット
            const minEdits: Record<number, string> = {};
            (prods as unknown as AirconProd[]).forEach(p => {
                minEdits[p.id] = String(p.minStock || 0);
            });
            setMinStockEdits(minEdits);
            // サフィックスを編集用にセット
            const sfxEdits: Record<number, string> = {};
            (prods as unknown as AirconProd[]).forEach(p => {
                sfxEdits[p.id] = p.suffix || "";
            });
            setSuffixEdits(sfxEdits);
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

    // 商品設定保存（統合: 単価 + サフィックス + 最低在庫）
    const getProductChanges = () => {
        return products.map(product => {
            const newPrice = parseInt(priceEdits[product.id]?.orderPrice || "0") || 0;
            const newSuffix = (suffixEdits[product.id] || "").trim().toUpperCase();
            const newMinStock = parseInt(minStockEdits[product.id] || "0") || 0;
            const priceChanged = newPrice !== product.orderPrice;
            const suffixChanged = newSuffix !== product.suffix;
            const minStockChanged = newMinStock !== product.minStock;
            return {
                product, newPrice, newSuffix, newMinStock,
                priceChanged, suffixChanged, minStockChanged,
                hasChange: priceChanged || suffixChanged || minStockChanged,
            };
        }).filter(c => c.hasChange);
    };

    const handleSaveAll = async () => {
        setSavingProducts(true);
        setShowConfirm(false);
        try {
            const changes = getProductChanges();
            for (const c of changes) {
                if (c.priceChanged) {
                    await updateAirconProductPrice(c.product.id, { orderPrice: c.newPrice });
                }
                if (c.suffixChanged) {
                    await updateAirconProductSuffix(c.product.id, c.newSuffix);
                }
                if (c.minStockChanged) {
                    await updateAirconMinStock(c.product.id, c.newMinStock);
                }
            }
            toast.success(`${changes.length}件の商品設定を保存しました`);
            setProductLocked(true);
            fetchData();
        } catch {
            toast.error("保存に失敗しました");
        } finally {
            setSavingProducts(false);
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

            {/* 商品設定（単価・サフィックス・最低在庫 統合） */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Settings className="h-5 w-5" /> 商品設定
                            </CardTitle>
                            <CardDescription>発注単価・サフィックス・最低在庫数を一括管理</CardDescription>
                        </div>
                        <Button
                            variant={productLocked ? "outline" : "destructive"}
                            size="sm"
                            onClick={() => setProductLocked(!productLocked)}
                        >
                            {productLocked ? <><Lock className="h-4 w-4 mr-1" /> ロック中</> : <><LockOpen className="h-4 w-4 mr-1" /> 編集中</>}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>品番 / 商品名</TableHead>
                                <TableHead className="w-[70px]">容量</TableHead>
                                <TableHead className="text-right w-[110px]">
                                    <div className="flex items-center justify-end gap-1"><DollarSign className="h-3 w-3" />発注単価</div>
                                </TableHead>
                                <TableHead className="text-center w-[110px]">
                                    <div className="flex items-center justify-center gap-1"><Tag className="h-3 w-3" />サフィックス</div>
                                </TableHead>
                                <TableHead className="text-center w-[80px]">
                                    <div className="flex items-center justify-center gap-1"><Package className="h-3 w-3" />最低在庫</div>
                                </TableHead>
                                <TableHead className="text-center w-[160px]">発注品番</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.map(product => {
                                const sfx = suffixEdits[product.id] || "";
                                return (
                                    <TableRow key={product.id}>
                                        <TableCell>
                                            <span className="font-mono text-xs text-muted-foreground mr-2">{product.code}</span>
                                            <span className="text-sm">{product.name}</span>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{product.capacity}</TableCell>
                                        {/* 発注単価 */}
                                        <TableCell className="text-right">
                                            {productLocked ? (
                                                <span className="font-mono text-sm">¥{parseInt(priceEdits[product.id]?.orderPrice || "0").toLocaleString()}</span>
                                            ) : (
                                                <Input
                                                    type="number" min={0} step={100}
                                                    className="h-8 text-right w-24"
                                                    value={priceEdits[product.id]?.orderPrice || "0"}
                                                    onChange={e => setPriceEdits({ ...priceEdits, [product.id]: { ...priceEdits[product.id], orderPrice: e.target.value } })}
                                                />
                                            )}
                                        </TableCell>
                                        {/* サフィックス */}
                                        <TableCell className="text-center">
                                            {productLocked ? (
                                                <span className="font-mono text-sm">{sfx || "-"}</span>
                                            ) : (
                                                <Input
                                                    className="h-8 text-center font-mono w-24"
                                                    maxLength={10}
                                                    value={sfx}
                                                    onChange={e => setSuffixEdits({ ...suffixEdits, [product.id]: e.target.value.toUpperCase() })}
                                                    placeholder="25SWSET"
                                                />
                                            )}
                                        </TableCell>
                                        {/* 最低在庫 */}
                                        <TableCell className="text-center">
                                            {productLocked ? (
                                                <span className="text-sm">{minStockEdits[product.id] || "0"}</span>
                                            ) : (
                                                <Input
                                                    type="number" min={0}
                                                    className="h-8 text-center w-16"
                                                    value={minStockEdits[product.id] || "0"}
                                                    onChange={e => setMinStockEdits({ ...minStockEdits, [product.id]: e.target.value })}
                                                />
                                            )}
                                        </TableCell>
                                        {/* 発注品番プレビュー */}
                                        <TableCell className="text-center">
                                            <span className="font-mono text-sm text-blue-600">{product.code}{sfx}</span>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    {!productLocked && (
                        <Button
                            onClick={() => {
                                const changes = getProductChanges();
                                if (changes.length === 0) {
                                    toast.info("変更はありません");
                                    return;
                                }
                                setShowConfirm(true);
                            }}
                            disabled={savingProducts}
                            className="w-full mt-4"
                        >
                            {savingProducts ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 保存中...</> : <><Save className="h-4 w-4 mr-1" /> 変更を保存</>}
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* 確認ダイアログ */}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>商品設定の変更確認</AlertDialogTitle>
                        <AlertDialogDescription>
                            以下の変更を保存します。よろしいですか？
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 max-h-60 overflow-y-auto text-sm">
                        {getProductChanges().map(c => (
                            <div key={c.product.id} className="p-2 bg-slate-50 rounded border space-y-0.5">
                                <div className="font-medium">{c.product.code} ({c.product.capacity})</div>
                                {c.priceChanged && (
                                    <div className="text-xs">
                                        <DollarSign className="inline h-3 w-3 mr-1" />
                                        単価: <span className="text-red-500 line-through">¥{c.product.orderPrice.toLocaleString()}</span>
                                        {" → "}<span className="text-green-600 font-medium">¥{c.newPrice.toLocaleString()}</span>
                                    </div>
                                )}
                                {c.suffixChanged && (
                                    <div className="text-xs">
                                        <Tag className="inline h-3 w-3 mr-1" />
                                        サフィックス: <span className="text-red-500 line-through">{c.product.suffix || "(なし)"}</span>
                                        {" → "}<span className="text-green-600 font-medium">{c.newSuffix || "(なし)"}</span>
                                        <span className="text-blue-600 ml-2">→ {c.product.code}{c.newSuffix}</span>
                                    </div>
                                )}
                                {c.minStockChanged && (
                                    <div className="text-xs">
                                        <Package className="inline h-3 w-3 mr-1" />
                                        最低在庫: <span className="text-red-500 line-through">{c.product.minStock}</span>
                                        {" → "}<span className="text-green-600 font-medium">{c.newMinStock}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSaveAll}>保存する</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
